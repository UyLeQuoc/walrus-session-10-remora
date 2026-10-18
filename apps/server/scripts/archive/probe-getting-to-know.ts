import { completeTurn } from "@remora/core";
import type { MemoryPort } from "@remora/memory";
import type { ModelMessage } from "ai";
import { model } from "../../src/context.ts";

const remembered: string[] = [];
const port = {
  scope: { mode: "guest", namespace: "probe", key: "", accountId: "", serverUrl: "" },
  recall: async () => [],
  remember: async (input: { type: string; text: string }) => {
    remembered.push(`[${input.type}] ${input.text}`);
    return { saved: true, note: "" };
  },
  flush: async () => {},
} as unknown as MemoryPort;

const cases: Array<{ name: string; gettingToKnow: boolean; messages: ModelMessage[] }> = [
  {
    name: "new person, a task",
    gettingToKnow: true,
    messages: [{ role: "user", content: "How do I reverse a list in Python?" }],
  },
  {
    name: "same task, hippo already knows them",
    gettingToKnow: false,
    messages: [{ role: "user", content: "How do I reverse a list in Python?" }],
  },
  {
    name: "new person, Vietnamese",
    gettingToKnow: true,
    messages: [{ role: "user", content: "Làm sao để đổi tên branch trong git?" }],
  },
  {
    name: "new person, in a hurry",
    gettingToKnow: true,
    messages: [
      { role: "user", content: "quick, no questions please: what port does Postgres use?" },
    ],
  },
  {
    name: "answers the first question",
    gettingToKnow: true,
    messages: [
      { role: "user", content: "How do I reverse a list in Python?" },
      {
        role: "assistant",
        content:
          "Use `my_list.reverse()` or `my_list[::-1]`.\n\nWhat are you working on at the moment?",
      },
      { role: "user", content: "A Sui dApp in TypeScript, the demo is due on 2026-10-09." },
    ],
  },
];

for (const run of [1, 2, 3]) {
  for (const c of cases) {
    remembered.length = 0;
    const { text } = await completeTurn({
      model,
      port,
      messages: c.messages,
      channel: "probe",
      userHandle: "probe",
      memoryEnabled: true,
      gettingToKnow: c.gettingToKnow,
    });
    const lastLine = text.trim().split("\n").filter(Boolean).at(-1) ?? "";
    const questions = (text.match(/\?/g) ?? []).length;
    console.log(
      `run ${run} | ${c.name} | ends with question: ${lastLine.trim().endsWith("?")} | ? count: ${questions}`,
    );
    console.log(`  last line: ${lastLine.slice(0, 160)}`);
    if (remembered.length) console.log(`  remembered: ${remembered.join(" | ")}`);
  }
}
