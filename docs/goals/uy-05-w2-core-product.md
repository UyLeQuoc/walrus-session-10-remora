# Goal U5: W2 core product end to end, on testnet (both lanes, one goal)

**Owner:** Uy's agent · **Runs in:** the main checkout, on `main` (ADR-0022) · **Depends on:** U3 + U4 (W1 on
testnet) · **Network:** money on testnet ([ADR-0024](../adr/0024-testnet-first.md)); memory on the mainnet
relayer ([ADR-0026](../adr/0026-network-switch.md); the relayer pays storage, and we send no SUI)

**Goal:** every W2 ship-set feature, backend and UI, so the **W2 exit** passes:

> - a new user goes from sign-in to their first remora in **under 3 minutes**;
> - **Scout** buys answers (sui-risk, odds, brief) and replies with Wakes;
> - **Sentinel** learns a rule from free text and applies it;
> - an **injected payment** is stopped by **Sonar**, and, when Sonar is forced off, by the **Disc**
>   onchain;
> - daily dogfooding can start (Nov 1).

The UI part takes Huấn's W2 items under [ADR-0027](../adr/0027-flex-takeover.md): claim them first, and skip
anything he has started.

## Prerequisites (Uy, before running)
- **`MEMWAL_ACCOUNT_ID`** in `.env`: your own Walrus Memory account (memory.walrus.xyz). The delegate key
  whose private key is `MEMWAL_PRIVATE_KEY` must be registered on it. This boots the full server, and
  remoras' memory lives there.
- **`TELEGRAM_BOT_TOKEN`**: a *test* bot from @BotFather (H1). The exit test can run on the web alone if
  it's missing, but H1 then stays unverified.
- Testnet funds are already provisioned: owner/burner USDC and the sponsor `0x4914…e122` (top up from
  the spike owner if low).

## Read first
- `docs/remora-spec.md` §3 (what a remora is), §4 (templates), §8 (memory), §9 (Wake), §10 (safety), §12
- `docs/remora-features.md` §0 and the W2 rows; `docs/team-split.md` §3 (W2 split)
- ADRs `0005`, `0007`, `0013`, `0014`, `0020`, `0024`–`0029`; `docs/tech-reference.md` §1 (MemWal gotchas
  §1.11)
- The code: `apps/server` (hippo agent loop, channels, money, runtime), `packages/{memory,core,disc-sdk,
  signer}`, `apps/web` (U4), `e2e/`, `spikes/w1/e2e.ts`

## Allowed paths
Everything in Uy's lane, plus Huấn's claimed W2 items (`apps/web/**`, `e2e/**`, `apps/server/src/copy/**`,
`docs/ux/**`). `packages/schema` changes only through **one contract PR**. Uy may merge it, and Huấn
reviews it after the fact.

## Phase A: backend (Uy's lane), each with tests
1. **Remoras (B1·be, B3, B8·be):**
   - a `remoras` table (owner, network, template, config, status, key via B4);
   - create from a template: a server-built **one-PTB** owner transaction (`propose_for_app` +
     `disc::issue`), signed by the wallet;
   - shadow → active, pause, retire (revoke + key retire).
2. **Memory mode (A3·be, F1):** remoras write into the operator's MemWal account, under per-owner and
   per-remora namespaces (hippo's guest mode). Owned mode (a delegate on the owner's account) comes with
   the mainnet pass. Write an ADR.
3. **Runtime:**
   - D3 turn engine (adapt hippo's agent loop) and D4 tools: `memory.recall/remember`, `tatum.*`,
     `web.fetch`, `pay` (→ `payWithDisc`), `notify`, `handoff`, `schedule`;
   - D9 model routing and per-remora token/cost caps;
   - D1 triggers: message (web + Telegram), cron (D2 jobs), chain (the U3 indexer + address/object
     filters).
4. **Safety (I1, I2, I4, I5):**
   - tag tool and web output `untrusted`;
   - **Sonar** = a deterministic policy (payee in the Disc and Reef, amount ≤ soft limit, schedule) + an
     independent check model; its verdict goes into the Wake;
   - rate limits per user/remora;
   - a secret scrubber before every memory write (F11a).
5. **Templates:**
   - **C1 Scout** answers by buying from `sui-risk`, `odds` and `brief`, keeps source scores (F2), and
     replies with a Wake;
   - **C2 Sentinel** watches addresses through the indexer and learns escalation rules from free text
     into memory (F2), then applies them.
6. **Money (B7·be, B9·be, E4·be, E9):**
   - budget change = revoke + reissue (one PTB);
   - rotate key;
   - over-limit approval: the owner signs a one-off payment;
   - the `odds` and `brief` merchants.
7. **Wake + memory APIs:**
   - F3·be inspector and F6 index check;
   - G3·be `remora verify` (CLI + API: the intent hash, `Paid`, the balance change, memory timestamps);
   - N19 feedback (useful/noise) into F2.
8. **Channels and N-items (be):**
   - H1 Telegram bot (remora messages, buttons Why/Teach/Mute/Approve, using copy v1) and A5 linking
     (`/start <nonce>` + an owner signature);
   - H5 notification policy;
   - APIs for N1 feed, N2 approvals, N4 why, N5 budget meter, N6 errors, N10 panic, N12 schedules, N13
     first-run win.

## Phase B: UI (Huấn's W2 items, claimed first)
A2 zkLogin (port), A3·ui, A5·ui, the A6 wizard (sign-in → memory → fund → Telegram → first remora),
A7 settings, B1/B6/B7/B8/B9·ui, E4·ui, live F3·ui, the G3·ui verify page, the H4 dashboard, H5·ui, and
N1/N2/N4/N5/N6/N10/N12/N13/N19·ui. Replace the U4 fixtures with live data.

## Phase C: the W2 exit e2e (testnet)
Playwright with the burner, plus a backend script, recording timings and digests in `docs/spikes/2026-xx-w2-exit.md`:
1. Sign-in → wizard → create Scout from a template (Disc issued) in **< 3 min**, measured.
2. Ask Scout a question: it buys from merchants, answers, and the Wake shows in "Why?" with
   `anchored`.
3. Tell Sentinel a rule in free text; trigger an event; Sentinel applies the rule (memory blob shown).
4. **Injection:** a merchant response tells the remora to pay an attacker.
   - **Sonar blocks it** (the Wake records it).
   - With Sonar forced off (a test flag), **the Disc aborts it onchain** (`EPayeeNotAllowed`).
5. Telegram (if the token is set): linking + one Scout reply with a Why button.

## Done when
- [x] Phase A + B are complete with tests; typecheck, lint, test, `sui move test` and `bun run e2e` are
      green; CI is green
- [x] The W2 exit e2e passes on testnet, with timings and digests recorded
      ([2026-10-19-w2-exit.md](../spikes/2026-10-19-w2-exit.md))
- [x] The contract PR is merged (#5); the ADRs (0030–0035), docs and handoffs to Huấn
      ([u5-landed](../handoffs/2026-10-19-uy-to-huan-u5-landed.md)) are written; everything is pushed to `main`

**Open after U5:**
- Telegram (H1) was not verified live: no test bot token.
- Model-written answers are unverified: the `.env` OpenRouter key is a placeholder, so the runtime used its deterministic fallbacks.

## Never
- Mainnet money: no Disc/USDC transactions or publish on mainnet (memory writes go through the relayer,
  per ADR-0026).
- Real owner accounts in tests (burner/test keys only). Committing `.env` or keys. Deploying.
- Editing an item Huấn has started or claimed. Ports 8787/5173.
