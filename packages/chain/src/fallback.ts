/**
 * ADR-0097: when Tatum answers 402 (the plan's credits are spent), Sui calls go to a public fullnode's
 * gRPC for a cool-down, then Tatum gets the next call again. Tatum stays the primary, and health shows
 * the switch. Every other error is Tatum's answer, so it passes through.
 */
import type {
  ClientStreamingCall,
  DuplexStreamingCall,
  MethodInfo,
  RpcOptions,
  RpcTransport,
  ServerStreamingCall,
  UnaryCall,
} from "@protobuf-ts/runtime-rpc";
import { settle, unaryCall } from "./paced.ts";
import type { SuiNetwork } from "./tatum.ts";

/** Mysten's public fullnode serves native gRPC on 443, streams included. */
export function publicGrpcUrl(network: SuiNetwork): string {
  return `https://fullnode.${network}.sui.io:443`;
}

/** Tatum's gateway answers HTTP 402 once the plan is spent; grpc-js reports it as UNKNOWN with the status in the text. */
export function isOutOfCredits(err: unknown): boolean {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === "string" && /\b402\b|plan limit exceeded/i.test(message);
}

export interface FallbackState {
  /** When calls first went to the fallback. */
  since: number;
  /** When Tatum gets the next call again. */
  until: number;
  /** Tatum's error, first line. */
  reason: string;
  /** Calls and stream opens that went to the fallback. */
  calls: number;
}

const states = new Map<SuiNetwork, FallbackState>();

/** Whether `network`'s calls go to the public fullnode right now; null while Tatum serves them. */
export function suiFallback(network: SuiNetwork, now = Date.now()): FallbackState | null {
  const s = states.get(network);
  return s && now < s.until ? { ...s } : null;
}

export function resetSuiFallback() {
  states.clear();
}

export interface FallbackOptions {
  network: SuiNetwork;
  /** How long calls skip Tatum after a 402. */
  coolDownMs?: number;
  now?: () => number;
  /** Called when calls start going to the fallback, not on every call. */
  onSwitch?: (reason: string) => void;
}

export class FallbackTransport implements RpcTransport {
  private readonly coolDownMs: number;
  private readonly now: () => number;

  constructor(
    private readonly tatum: RpcTransport,
    private readonly fallback: RpcTransport,
    private readonly opts: FallbackOptions,
  ) {
    this.coolDownMs = opts.coolDownMs ?? 10 * 60_000;
    this.now = opts.now ?? Date.now;
  }

  mergeOptions(options?: Partial<RpcOptions>): RpcOptions {
    return this.tatum.mergeOptions(options);
  }

  /** Counts a call against an active fallback; false while Tatum serves calls. */
  private onFallback(): boolean {
    const s = states.get(this.opts.network);
    if (!s || this.now() >= s.until) return false;
    s.calls++;
    return true;
  }

  private trip(err: unknown) {
    const now = this.now();
    const s = states.get(this.opts.network);
    const active = !!s && now < s.until;
    const message = err instanceof Error ? err.message : String(err);
    const reason = (message.split("\n", 1)[0] ?? "").slice(0, 160);
    states.set(this.opts.network, {
      since: active && s ? s.since : now,
      until: now + this.coolDownMs,
      reason,
      calls: active && s ? s.calls : 0,
    });
    if (!active) this.opts.onSwitch?.(reason);
  }

  unary<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    input: I,
    options: RpcOptions,
  ): UnaryCall<I, O> {
    if (this.onFallback()) return this.fallback.unary(method, input, options);
    const done = (async () => {
      try {
        return await settle(this.tatum.unary(method, input, options));
      } catch (err) {
        if (!isOutOfCredits(err)) throw err;
        // The gateway refused the call, so nothing ran: even ExecuteTransaction is safe to resend.
        this.trip(err);
        this.onFallback();
        return settle(this.fallback.unary(method, input, options));
      }
    })();
    return unaryCall(method, input, options, done);
  }

  serverStreaming<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    input: I,
    options: RpcOptions,
  ): ServerStreamingCall<I, O> {
    if (this.onFallback()) return this.fallback.serverStreaming(method, input, options);
    // A stream's 402 arrives after it opens. Its owner (the watcher, the indexer) reconnects after a
    // backoff, and that open goes to the fallback.
    const call = this.tatum.serverStreaming(method, input, options);
    call.responses.onError((err) => {
      if (isOutOfCredits(err)) this.trip(err);
    });
    return call;
  }

  clientStreaming<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    options: RpcOptions,
  ): ClientStreamingCall<I, O> {
    return this.tatum.clientStreaming(method, options);
  }

  duplex<I extends object, O extends object>(
    method: MethodInfo<I, O>,
    options: RpcOptions,
  ): DuplexStreamingCall<I, O> {
    return this.tatum.duplex(method, options);
  }
}
