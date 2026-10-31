/**
 * M7 (ADR-0012, ADR-0046): the safety review a shared remora passes before it's published and again
 * before anyone hatches it. Deterministic checks can block; a model can only add a warning (models
 * only tighten, and a model saying "fine" never clears a block).
 *
 * - **scrubber:** no credentials anywhere in the file.
 * - **patterns:** no prompt-injection or exfiltration phrasing in personas, rules or schedule questions.
 * - **raw addresses:** no `0x…` addresses at all, and no watched addresses (payees are Reef only).
 * - **reef:** every remora is a known kind, and every payee it may pay resolves on this network's Reef.
 */
import { redactCredentials } from "@remora/memory";
import type { SafetyFinding, SafetyReport, TeamFile } from "@remora/schema";
import { TEMPLATES } from "../templates/index.ts";

const INJECTION: [RegExp, string][] = [
  [
    /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|system)\b[^.\n]{0,20}\b(instructions?|rules?|prompts?|guidelines?)\b/i,
    "Tells the model to ignore its instructions.",
  ],
  [/\b(system prompt|developer message|jailbreak|DAN mode)\b/i, "Talks about the system prompt."],
  [/<\/?\s*(untrusted|system|assistant|tool)\b/i, "Tries to break out of the data tags."],
  [/\byou are (now|no longer)\b/i, "Tries to change who the remora is mid-conversation."],
];

const EXFILTRATION: [RegExp, string][] = [
  [
    /\b(private key|secret key|seed phrase|mnemonic|recovery phrase|api key|session token|password)s?\b/i,
    "Asks for keys or secrets.",
  ],
  [
    /\b(send|transfer|pay|withdraw|forward|drain|move)\b[^.\n]{0,40}\b(all|every|entire|whole|max(imum)?|everything)\b/i,
    "Asks to move all funds.",
  ],
  [
    /\b(send|post|upload|forward|leak|share)\b[^.\n]{0,40}\b(memor(y|ies)|wakes?|history|conversations?)\b[^.\n]{0,40}\b(to|at)\b/i,
    "Asks to send memories or history somewhere.",
  ],
  [
    /https?:\/\/(?!localhost\b)[^\s)]+/i,
    "Links to a web address; a remora only pays listed services.",
  ],
];

const RAW_ADDRESS = /\b0x[0-9a-fA-F]{16,64}\b/;

export interface SafetyInput {
  team: TeamFile;
  markdown: string;
  /** This network's Reef references (`reef:<slug>`). */
  reef: string[];
  /** Optional model review; it can only warn. */
  model?: (text: string) => Promise<{ flagged: boolean; reason: string } | null>;
  now?: Date;
}

/** Every piece of free text in a team file, with where it is. */
function texts(team: TeamFile): { where: string; text: string }[] {
  const out = [
    { where: "name", text: team.name },
    { where: "description", text: team.description ?? "" },
  ];
  team.remoras.forEach((r, i) => {
    out.push({ where: `remoras[${i}].name`, text: r.name });
    if (r.persona) out.push({ where: `remoras[${i}].persona`, text: r.persona });
    r.rules.forEach((t, k) => {
      out.push({ where: `remoras[${i}].rules[${k}]`, text: t });
    });
    r.schedules.forEach((s, k) => {
      out.push({ where: `remoras[${i}].schedules[${k}].question`, text: s.question });
    });
  });
  return out.filter((t) => t.text);
}

export async function reviewTemplate(input: SafetyInput): Promise<SafetyReport> {
  const findings: SafetyFinding[] = [];
  const checks = ["scrubber", "patterns", "reef"];
  const block = (code: SafetyFinding["code"], where: string, detail: string) =>
    findings.push({ severity: "block", code, where, detail });

  const scrubbed = redactCredentials(input.markdown);
  for (const kind of scrubbed.removed) block("secret", "file", `Contains a credential (${kind}).`);

  for (const { where, text } of texts(input.team)) {
    for (const [re, detail] of INJECTION) if (re.test(text)) block("injection", where, detail);
    for (const [re, detail] of EXFILTRATION)
      if (re.test(text)) block("exfiltration", where, detail);
    const addr = RAW_ADDRESS.exec(text)?.[0];
    if (addr)
      block(
        "raw_address",
        where,
        `Names a raw address (${addr.slice(0, 8)}…); payees must be listed services.`,
      );
  }

  const reef = new Set(input.reef);
  input.team.remoras.forEach((r, i) => {
    const kind = TEMPLATES[r.template as keyof typeof TEMPLATES];
    if (!kind) {
      block("unknown_template", `remoras[${i}].template`, `No remora kind called ${r.template}.`);
      return;
    }
    if (r.watch.length)
      block(
        "raw_address",
        `remoras[${i}].watch`,
        "Shared remoras can't come with addresses to watch; a hatched Sentinel watches its new owner.",
      );
    for (const ref of kind.payees)
      if (!reef.has(ref))
        block("unknown_payee", `remoras[${i}]`, `${ref} isn't a listed service on this network.`);
  });

  if (input.model) {
    const all = texts(input.team)
      .map((t) => `${t.where}: ${t.text}`)
      .join("\n")
      .slice(0, 6_000);
    const verdict = await input.model(all).catch(() => null);
    if (verdict) {
      checks.push("model");
      if (verdict.flagged)
        findings.push({
          severity: "warn",
          code: "model_flag",
          where: "file",
          detail: verdict.reason.slice(0, 200) || "The model found something to look at.",
        });
    }
  }

  const verdict = findings.some((f) => f.severity === "block")
    ? "block"
    : findings.length
      ? "warn"
      : "pass";
  return { verdict, findings, checks, checkedAt: (input.now ?? new Date()).toISOString() };
}
