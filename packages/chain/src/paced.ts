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

export interface PacingOptions {
  /** Unary calls started per second, across the whole client. */
  maxRps: number;
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

  constructor(
    private readonly inner: RpcTransport,
    opts: PacingOptions,
  ) {
    this.interval = 1000 / opts.maxRps;
    this.retries = opts.rateLimitRetries ?? 4;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
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
        const call = this.inner.unary(method, input, options);
        try {
          const [headers, response, status, trailers] = await Promise.all([
            call.headers,
            call.response,
            call.status,
            call.trailers,
          ]);
          return { headers, response, status, trailers };
        } catch (err) {
          if (attempt >= this.retries || !isRateLimited(err)) throw err;
          await this.sleep(this.interval * 2 ** (attempt + 1));
        }
      }
    })();
    // Callers usually await only `response`; the other parts mustn't surface as unhandled rejections.
    const part = <T>(pick: (d: Awaited<typeof done>) => T): Promise<T> => {
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
      part((d): RpcStatus => d.status),
      part((d) => d.trailers),
    );
  }

  serverStreaming<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    input: I,
    options: RpcOptions,
  ): ServerStreamingCall<I, O> {
    return this.inner.serverStreaming(method, input, options);
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
