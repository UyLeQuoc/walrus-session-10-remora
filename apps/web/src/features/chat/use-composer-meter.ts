import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { type ComposerMeter, DEFAULT_MODEL_ID, meterFor } from "./composer-meter";

const HealthModel = z.object({ model: z.string().min(1) });

type Part = { type: string; text?: string };

function textOfParts(parts: readonly Part[] | undefined): string {
  return (parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export function useComposerMeter(
  messages: ReadonlyArray<{ role: string; parts?: readonly Part[] }>,
  draft: string,
): ComposerMeter {
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);

  useEffect(() => {
    let cancelled = false;
    const load = apiFetch("/api/health")
      .then(async (res) => {
        if (!res.ok) return null;
        return HealthModel.safeParse(await res.json());
      })
      .catch(() => null);
    void load.then((parsed) => {
      if (!cancelled && parsed?.success) setModelId(parsed.data.model);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () =>
      meterFor({
        modelId,
        draft,
        turns: messages.map((message) => ({
          role: message.role,
          text: textOfParts(message.parts),
        })),
      }),
    [modelId, draft, messages],
  );
}
