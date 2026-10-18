import type { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  fallback: string,
): Promise<ApiResult<T>> {
  try {
    const res = await apiFetch(path, init);
    if (!res.ok) return { ok: false, error: await errorMessage(res, fallback) };
    const parsed = schema.safeParse(await res.json().catch(() => null));
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: fallback };
  } catch {
    return { ok: false, error: fallback };
  }
}

export function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: string,
): Promise<ApiResult<T>> {
  return request(path, {}, schema, fallback);
}

export function apiPost<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const init: RequestInit =
    body === undefined
      ? { method: "POST" }
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        };
  return request(path, init, schema, fallback);
}
