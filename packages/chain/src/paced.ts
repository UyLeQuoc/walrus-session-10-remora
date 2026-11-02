import {
  type ClientStreamingCall,
  type DuplexStreamingCall,
  type MethodInfo,
  type RpcMetadata,
  type RpcOptions,
  type RpcStatus,
  type RpcTransport,
  type ServerStreamingCall,
  UnaryCall,
} from "@protobuf-ts/runtime-rpc";

/** Tatum's gateway answers HTTP 429, which grpc-js reports as UNAVAILABLE with the status in the text. */
export function isRateLimited(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (e?.code === "RESOURCE_EXHAUSTED") return true;
  return e?.code === "UNAVAILABLE" && typeof e.message === "string" && e.message.includes("429");
}

const usage = new Map<string, number>();
/** Requests per minute for the last hour, so health can show the current rate (ADR-0080). */
const perMinute = new Map<number, number>();
const count = (key: string) => {
  usage.set(key, (usage.get(key) ?? 0) + 1);
  const m = Math.floor(Date.now() / 60_000);
  perMinute.set(m, (perMinute.get(m) ?? 0) + 1);
  if (perMinute.size > 61) for (const k of perMinute.keys()) if (k <= m - 60) perMinute.delete(k);
};

/** Requests and stream frames sent to Tatum in the 60 minutes before `now`. */
export function tatumCallsLastHour(now = Date.now()): number {
  const m = Math.floor(now / 60_000);
  let n = 0;
  for (const [k, v] of perMinute) if (k > m - 60 && k <= m) n += v;
  return n;
}

/**
 * What this process has asked Tatum for since it started: unary requests (retries included) and
 * stream frames, per method. A stream's frames are what spent a month's credits (ADR-0058).
 */
export function tatumUsage(): Record<string, number> {
  return Object.fromEntries([...usage].sort(([a], [b]) => a.localeCompare(b)));
}

export function resetTatumUsage() {
  usage.clear();
  perMinute.clear();
}

/** A unary call's four parts, once all of them have arrived. */
export interface Settled<O extends object> {
  headers: RpcMetadata;
  response: O;
  status: RpcStatus;
  trailers: RpcMetadata;
}

export async function settle<I extends object, O extends object>(
  call: UnaryCall<I, O>,
): Promise<Settled<O>> {
  const [headers, response, status, trailers] = await Promise.all([
    call.headers,
    call.response,
    call.status,
    call.trailers,
  ]);
  return { headers, response, status, trailers };
}

/** A `UnaryCall` whose parts come from `done`, for a transport that decides where a call goes. */
export function unaryCall<I extends object, O extends object>(
  method: MethodInfo<I, O>,
  input: I,
  options: RpcOptions,
  done: Promise<Settled<O>>,
): UnaryCall<I, O> {
  // Callers usually await only `response`; the other parts mustn't surface as unhandled rejections.
  const part = <T>(pick: (d: Settled<O>) => T): Promise<T> => {
    const p = done.then(pick);
    p.catch(() => {});
    return p;
  };
  return new UnaryCall<I, O>(
    method,
    (options.meta ?? {}) as RpcMetadata,
    input,
    part((d) => d.headers),
    part((d) => d.response),
    part((d) => d.status),
    part((d) => d.trailers),
  );
}

export interface PacingOptions {
  /** Unary calls started per second, across the whole client. */
  maxRps: number;
  /** Counts toward `tatumUsage` (the default). The public fallback isn't Tatum (ADR-0097). */
  metered?: boolean;
  /** Retries after a 429. The gateway rejected the call, so even ExecuteTransaction is safe to resend. */
  rateLimitRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Spaces unary calls to stay under the plan's rate limit and retries the ones the gateway bounces with
 * 429. `SuiGrpcClient` makes several calls per `tx.build`, so pacing has to sit under the client, not
 * around our own calls. Streams pass through unpaced.
 */
export class PacedTransport implements RpcTransport {
  private nextAt = 0;
  private readonly interval: number;
  private readonly retries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly count: (key: string) => void;

  constructor(
    private readonly inner: RpcTransport,
    opts: PacingOptions,
  ) {
    this.interval = 1000 / opts.maxRps;
    this.retries = opts.rateLimitRetries ?? 4;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.count = opts.metered === false ? () => {} : count;
  }

  mergeOptions(options?: Partial<RpcOptions>): RpcOptions {
    return this.inner.mergeOptions(options);
  }

  private async slot(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.nextAt);
    this.nextAt = at + this.interval;
    if (at > now) await this.sleep(at - now);
  }

  unary<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    input: I,
    options: RpcOptions,
  ): UnaryCall<I, O> {
    const done = (async () => {
      for (let attempt = 0; ; attempt++) {
        await this.slot();
        this.count(method.name);
        try {
          return await settle(this.inner.unary(method, input, options));
        } catch (err) {
          if (attempt >= this.retries || !isRateLimited(err)) throw err;
          await this.sleep(this.interval * 2 ** (attempt + 1));
        }
      }
    })();
    return unaryCall(method, input, options, done);
  }

  serverStreaming<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    input: I,
    options: RpcOptions,
  ): ServerStreamingCall<I, O> {
    // A stream (checkpoints) lives until its caller aborts it; the per-call deadline is for unary
    // calls. With it, Tatum's stream was cut every 30 s and events between reconnects were lost.
    this.count(`${method.name} (opened)`);
    const call = this.inner.serverStreaming(method, input, {
      ...options,
      timeout: Number.POSITIVE_INFINITY,
    });
    call.responses.onMessage(() => this.count(`${method.name} (frames)`));
    return call;
  }

  clientStreaming<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    options: RpcOptions,
  ): ClientStreamingCall<I, O> {
    return this.inner.clientStreaming(method, options);
  }

  duplex<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    options: RpcOptions,
  ): DuplexStreamingCall<I, O> {
    return this.inner.duplex(method, options);
  }
}
