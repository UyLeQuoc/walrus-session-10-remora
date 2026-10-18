import { completeTurn, type TurnInput } from "@remora/core";
import type { ModelMessage } from "ai";

export type CompareInput = Pick<
  TurnInput,
  "model" | "port" | "messages" | "channel" | "userHandle" | "abortSignal"
>;

export function memoryOffTurn(input: CompareInput): TurnInput {
  return { ...input, memoryEnabled: false };
}

export async function answerWithoutMemory(input: CompareInput): Promise<string> {
  return (await completeTurn(memoryOffTurn(input))).text;
}

export function throughLastQuestion(messages: readonly ModelMessage[]): ModelMessage[] | null {
  const last = messages.map((message) => message.role).lastIndexOf("user");
  return last === -1 ? null : messages.slice(0, last + 1);
}
