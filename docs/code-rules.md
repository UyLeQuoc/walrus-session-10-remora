# Code rules (imported from hippo)

> Imported from hippo (prior work, Walrus Sessions 8, commit 66fb33a): its `AGENTS.md` and `CODE_RULES.md`, verbatim.
> Remora-specific agent rules are in the root `AGENTS.md`.

## hippo AGENTS.md

## hippo — Walrus Session 8 "Chatbots That Remember"

Multi-channel chatbot (web, Telegram, Discord, Slack) where each user owns their memory on their own Walrus Memory account and the bot is only a revocable delegate. Hackathon deadline **Oct 9, 2026 14:00 UTC**.

### Highest rule

When writing or changing code, [`CODE_RULES.md`](CODE_RULES.md) outranks this file, nearby code, and every other doc. Read it before editing. Follow it. If this file and `CODE_RULES.md` disagree about how to write code, `CODE_RULES.md` wins. The product constraints below still apply; they are not a license to skip `CODE_RULES.md`.

### Read first

- `docs/GOAL.md` — **the master execution plan.** Milestones M0–M7 with tasks, verification commands, pre-made decisions, cut order, and the list of inputs only the human can provide. If you are asked to "continue" or "do the next thing", start here.
- `docs/CHAT-UPGRADE.md` — the chat workspace upgrade (controls, in-chat memory, private Walrus files). If you are asked to continue that upgrade, start here instead of adding a feature to the current chat page.
- `docs/BRIEF.md` — hackathon rules, judging, prizes, submission checklist. Source of truth for what must ship.
- `docs/IDEA.md` — the pitch and why it wins.
- `docs/ARCHITECTURE.md` — components, identity model (guest vs owned), onboarding and revoke flows, memory layer, stack, spikes.
- `docs/PLAN.md` — timeline, real-user plan, bug bounty list, article outline.
- `docs/MEMWAL-NOTES.md` — SDK, relayer API, on-chain model, sponsorship, MCP notes.
- `docs/SPIKES.md` — everything measured on mainnet and what it changed, including one hypothesis that had to be retracted.
- `docs/BLOCKERS.md` — what only the user can provide. Read it before assuming something is blocked.
- `docs/DECISIONS.md` — the running decision log.
- `docs/RUNBOOK.md` — how to run the real-use week: invite text, consent rules, daily checklist.
- `docs/issues/` — thirteen bug reports drafted against Walrus Memory, re-verified 2026-09-25: nine still stand, four are marked (02 on hold, 03 not reproduced, 07 resolved before filing, 08 retracted). None filed yet; `scripts/file-issues.sh` files the nine.
- `docs/AUDIT.md` — every task in GOAL.md checked against the codebase, with what is blocked and why. Read this before concluding there is nothing left to do.

### Commands worth knowing

| | |
|---|---|
| `bun run dev` | Starts Postgres, applies the schema, then runs the API and web app in the Turbo TUI. |
| `bun run diagnose` | What is configured, what works, and where the chain and the relayer disagree. Run this first when anything looks wrong. |
| `bun run demo` | The memory eval: teaches five facts and one correction, drops the conversation, then asserts cross-session recall, that the newer of two conflicting memories wins, style adaptation and cross-channel recall, then a memory-off control on the same questions and the recall cost per turn. |
| `bun run evidence` | The numbers the submission form asks for, counting only memories that landed on Walrus. |
| `bun run smoke` | Health, identity and (with `--write`) one round trip on mainnet. |
| `bun run restore` | Compares the relayer's index against what we wrote, and warns when restore sees nothing. |
| `bun run hippo` | The CLI channel, talking to a running server. |

### Reference clone: `memwal/`

`memwal/` is a **read-only clone of https://github.com/MystenLabs/MemWal** kept for reference. It is gitignored. If it is missing, restore it with:

```bash
git clone --depth 1 https://github.com/MystenLabs/MemWal.git memwal
```

Never edit files inside `memwal/`. Never import from it; depend on the published `@mysten-incubation/memwal` package. When unsure how the SDK or relayer behaves, read the source there before guessing: `memwal/SKILL.md`, `memwal/packages/sdk/src/`, `memwal/apps/app/src/` (dashboard flows), `memwal/services/server/src/routes/` (relayer).

### Hard constraints

- Mainnet only. Relayer `https://relayer.memory.walrus.xyz`. Package and registry IDs are in `docs/ARCHITECTURE.md` §8.
- Delegate private keys never leave the server and never appear in logs, chat messages, or the browser. Users' keys are stored encrypted (AES-256-GCM with `KEY_ENCRYPTION_KEY`).
- Namespace names are public on-chain. Only `hippo` (owned), `hippo-guest:<personId>` (guest), `hippo-team:<id>` (shared, one per person, written only by `/team remember`) are allowed.
- Do not use `withMemWal` autoSave. Memory writes go through the `remember` tool with dedupe.
- Memory text is never stored in Postgres. `memory_index` holds blob IDs, types, hashes and dates only. Text comes from Walrus.
- Strip credentials (API keys, private keys, tokens) from any text before `remember`.
- No custom MCP server. Portability is demonstrated with the official Walrus Memory MCP plugin on the same account.
- LLM goes through OpenRouter (`@openrouter/ai-sdk-provider`). Primary model `google/gemini-2.5-flash`. Never route to an OpenAI or Anthropic model; it disqualifies the "Beyond the Big Two" track.
- Every SDK or relayer friction you hit gets a note in `docs/PLAN.md` under bug bounty candidates, with a repro.
- Blocked on something only the human has (keys, tokens, accounts)? Do all other work, append the exact ask to `docs/BLOCKERS.md`, and continue with the next milestone. Do not stop and do not fabricate.

### Repo layout (target)

```
apps/web         Vite + React + Tailwind v4 + shadcn/ui: chat, /connect/:token, /disconnect/:token, /me, /team
apps/server      Hono API (/api/chat streaming, /api/connect/*, /api/me/*) + channel adapters
  src/channels/  telegram (grammY), discord (discord.js), slack (Bolt socket mode), web
packages/core    agent loop, prompts, tools (remember / recall), channel-agnostic
packages/memory  MemWal client factory (guest / owned), text format, dedupe, recall policy
packages/db      Drizzle schema (people, channel_identities, delegate_keys, connect_tokens, turn_log, memory_index)
.claude/skills/  hippo-memory skill so external agents understand the memory format
docs/            see above
memwal/          reference clone (gitignored)
```

### Checks

`bun run lint` fails on warnings, not just errors, so unused imports and other drift
do not accumulate. The web pages have jsdom render tests (`apps/web/src/app/pages.test.tsx`)
that mount each page with the network stubbed and assert what a reader sees, because
typecheck and build both pass happily on a component that throws on first paint. `.github/workflows/ci.yml` runs lint, typecheck, test, the web
build and `bun pm scan` on every push, plus a guard that `.env`, `memwal/` and
`.turbo/` are never tracked. CI uses Bun for package management and Node 20 for
the application checks. `jsdom` is pinned to 26 because 30 needs Node 22. There are two
`overrides` entries: esbuild,
because `drizzle-kit` still pulls a version with a dev-server advisory it never
uses, and `source-map-js` >=1.2.2, because Tailwind and PostCSS still pin 1.2.1,
which carries CVE-2026-93749 and makes `bun install` abort under the OSV scanner. Tests that read the real mainnet account skip themselves when
credentials are absent, so a fork gets a green run without secrets.

### Conventions

- TypeScript strict, Bun workspaces, Turbo, Node 20 runtime.
- Channel adapters contain no memory or LLM logic; they only translate messages to and from `packages/core`.
- Memory text format: `[type] [by:@user] [#channel]? [YYYY-MM-DD] fact` (see `docs/ARCHITECTURE.md` §5).
- Secrets only in `.env` files, which are gitignored. Keep `.env.example` current.
- Commit messages: imperative, one line, no scope prefixes.


## hippo CODE_RULES.md

## CODE_RULES

This file is the highest rule for writing code in this repo. It outranks nearby files, older docs, and habit. Read it before editing. If `AGENTS.md` and this file disagree about *how* to write code, this file wins. Product constraints in `AGENTS.md` (mainnet, keys, models, namespaces) still apply; they are not a license to ignore these rules.

Match these rules in new and changed code. Do not copy a violation because the file next door already does it. When you touch a violating file, bring the lines you change into compliance. Do not rewrite the whole file unless that is the task.

### TypeScript

- Strict mode stays on. Do not weaken `tsconfig` to make a change compile.
- No `any`. No `as any`. No `// @ts-ignore` and no `// @ts-expect-error` unless the line says why the types are wrong and a follow-up exists.
- Prefer `unknown` at a boundary, then narrow. A cast is a last resort, and only after a runtime check.
- External input is untrusted. Parse it with zod (request bodies, env, webhook payloads, tool arguments). Infer the type from the schema (`z.infer`) instead of declaring a parallel interface.
- Exported functions take and return explicit types when the inferred type would leak a library's internals or an anonymous object. Do not annotate what the compiler already knows.
- No non-null assertion (`!`) on a value that might be missing. Handle the missing case.
- Prefer a union and an exhaustive `switch` over boolean flags and stringly modes. `never` in the default branch.
- Do not use enums. Use a const object or a string union.
- Async functions do not swallow errors. Catch only to translate into a typed result or a user-facing sentence, then rethrow or return that result. No empty `catch`.
- No floating promises. `await` them, or pass them to something that handles rejection.
- Imports are type-only when they are types (`import type`). The server keeps the `.ts` extension on relative imports. The web app uses the `@/` alias.
- No barrel `index.ts`. Import the module that owns the symbol.
- No default exports, except a file a tool requires one from (Vite config, a shadcn primitive that already has one).
- Do not add comments. Names and types carry the meaning. A comment is allowed only when the next reader would otherwise repeat a measured mistake (a relayer quirk, a security reason).

### Reuse

- A pure function with no I/O is the default unit of reuse. It takes data in and returns data out. No hidden `db`, `env`, or `fetch`.
- The second caller extracts. The first caller stays inline unless leaving it inline mixes two jobs in one file (HTTP plus domain, render plus request).
- Copy-paste of more than a few lines is a bug. Share the function. Do not share by reaching into another feature's private file for one helper; move the helper up to the folder both already import.
- Do not invent a wrapper, a base class, or a generic "utils" bag for one call site. `lib/` and `packages/` hold code that already has two callers, or a boundary (env, crypto, HTTP client) that must not be reimplemented.
- Dependencies point inward. A UI file does not import a server module. A channel adapter does not import a route. A domain module does not import Hono, grammY, discord.js, or Bolt.
- Configuration and copy that can change without a behavior change live next to the code that reads them, not inlined in three switches.

### Frontend (`apps/web`)

#### Where files go

- A route screen lives in `src/features/<feature>/<feature>-page.tsx`.
- A component used by one feature lives in that feature folder. A component used by two features lives in `src/components/`.
- shadcn primitives stay in `src/components/ui/`. prompt-kit stays in `src/components/prompt-kit/`. Do not move them. Do not edit them to restyle one screen. Add a primitive with the shadcn CLI, then compose it.
- Shared chrome (logo, theme) stays in `src/components/`. App shell stays in `src/app/`.

#### Logic stays out of the render

Pages and components render. They do not own rules.

- A page or component does not `fetch`, does not parse an API payload, does not decide a business rule, and does not run a multi-step flow (connect, export, hide, sign-in).
- That work lives in a hook colocated with the feature: `src/features/<feature>/use-<name>.ts`. A hook shared by two features lives in `src/hooks/`.
- The hook returns data, status, and callbacks. The component calls the hook and paints what it returns.
- A component may keep ephemeral UI state only: open or closed, focus, a draft that has not been submitted. The moment that state is sent, stored, or branched on a rule, it moves into the hook.
- Do not put `useEffect` data loading in a page or a panel. The page calls `useMe()`; `useMe` owns the request, the error sentence, and the reload.
- A hook does not return JSX.

#### shadcn

If shadcn has the primitive, use it. Do not hand-roll a button, input, textarea, card, badge, alert, dialog, sheet, tooltip, skeleton, separator, or sidebar.

- Import from `@/components/ui/<name>`.
- Compose with `className` for layout only: width, max-width, gap from the parent. Do not restyle the primitive's height, padding, radius, or type scale to invent a new size.
- `size="sm"` is forbidden on every shadcn component that has a size variant, including `Button`. So is any class that imitates it (`h-7`, `h-8`, `px-2`, `text-xs` on the control itself). The default size is the size.
- A smaller control is allowed only when the user has explicitly said that specific control may be small. Do not infer permission from a tight layout or a mobile width.
- Icons come from `lucide-react`, the library named in `components.json`. Do not add a second icon set for one screen.
- Class names merge through `cn` from `@/lib/utils`. Do not write a second `cn`.
- Do not add `"use client"`. This app is Vite, not Next.

#### What a component file looks like

A component file exports a named function component, takes props, and returns elements. If the file also exports a pure formatter used by one sibling, that formatter moves to a `.ts` file beside it the moment a second component needs it. API types shared with a hook live next to the hook, not inside the TSX.

### Backend (`apps/server`)

#### Where files go

- `src/routes/` is the HTTP surface. A route file parses the request, checks the caller, calls a domain function, and maps the result to a status and a body. It does not contain the rule.
- New behavior goes in the domain folder that already owns it: `chat/`, `identity/`, `connect/`, `memory/`, `channels/`. Do not add another case to `routes/chat.ts` or `chat/commands.ts` if the work can live in a module those files call.
- `src/channels/` translates a platform event into `handleIncoming` and a reply back out. No SQL, no memory, no model call, no command policy.
- `src/env/load.ts` exits the process on a bad env. Tests and libraries import `src/env/schema.ts`. Only the process entry imports `load.ts`.
- `src/ops/` is for scripts. The running server does not import it.

#### Boundaries

- Validate every body, query, and header you branch on, with zod, at the route. Do not trust `c.req.json()` as `any`.
- Domain functions take already-parsed values and a small context (`db`, `env` fields they need). They do not take a Hono `Context`.
- One function, one failure mode the caller can handle. Return a typed result (`{ ok: true, ... } | { ok: false, reason }`) for expected failures (unknown token, rate limit, not found). Throw for programmer errors and for upstream faults the route will turn into one sentence.
- A sentence shown to a user names what failed and what they can do. It does not include a stack, a SQL fragment, a private key, a token, or the upstream JSON.
- Do not log a private key, a session token, a delegate key, or memory text. Log an id, a status, and a reason code.
- Channel command names are declared once and imported by Telegram, Discord, and Slack registration. Do not keep a second handwritten list.
- Scripts that are one-off probes stay in `scripts/archive/`. A script a human runs on a schedule stays in `scripts/` and is wired from `package.json`.

#### Data

- Memory text is not a column. Postgres holds ids, hashes, types, and dates. Text comes back from Walrus.
- A write that tells the user it was saved must be recoverable if the process dies after that sentence. Do not acknowledge a memory the index cannot see.
- Namespace strings are built in `packages/memory`, not concatenated in a route.

### Tests

- A test sits next to the module it imports, and the file name matches that module (`limits.test.ts` tests `limits.ts`, not `turn.ts`).
- Test the pure function and the hook's rule. Do not snapshot a page to avoid naming the behavior.
- A test that needs Postgres or mainnet skips itself when the credential is absent. It does not fake a passing result.
- Do not delete or weaken an assertion to go green.

### Before you finish

`bun run typecheck`, `bun run lint`, and `bun run test` are green. Lint fails on warnings. Unused imports are not a style preference; they are a failed check.
