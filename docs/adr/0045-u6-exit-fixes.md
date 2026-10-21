# ADR-0045: What the U6 exit changed: Sonar's check model, hex addresses in YAML, reading owner transactions, room routing, the watcher filter, honest paid answers

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy (agent, U6 Phase C)

## Context
The U6 exit e2e and a probe with a real OpenRouter key found ten defects that unit tests couldn't:
1. **The check model failed its schema.** With `LLM_SMALL_MODEL` unset, Sonar's check model and rule parsing ran on `LLM_FALLBACK_MODEL` (`qwen/qwen3.7-flash`). Its check answers had reasons longer than the schema's 200 characters, so every check failed and Sonar ran on its deterministic policy alone. It also blocked a legitimate `sui-risk` purchase. With the same prompt, `google/gemini-2.5-flash` and `deepseek-v4.1-flash` answered in shape and allowed it.
2. **Unquoted addresses became numbers.** YAML reads an unquoted `0x…` scalar as a hex integer. A Sentinel's `watch: - 0xd270…` in a team file became a number that had lost its digits.
3. **The server confirmed before Tatum saw the transaction.** The wallet executes through the browser's fullnode and waits for it. `POST /api/teams/confirm` then read the same digest through Tatum a moment later and got "not found".
4. **The burner ran out of gas.** The testnet burner ran out of SUI for gas after repeated W2 and U6 runs.
5. **A room's signal picked the wrong remora.** The default room holds every live remora. With Scouts left from earlier runs, an odds question went to the first Scout in the list, not to the room's lead.
6. **A revoked Disc failed silently.** That old Scout's Disc had been revoked onchain while the database still said active. Reading the Disc threw, and the room showed only "Something went wrong", with nothing in the log.
7. **Sentinels stopped hearing the chain past 10 addresses.** The D1 watcher ORs one `affectedAddress` literal per watched address. The fullnode rejects a checkpoint filter with more than 10 literals ("filter contains 11 literals; at most 10 are allowed"), so the stream kept reconnecting and no Sentinel got pings.
8. **The paid answer after Pay once ran on the default model.** Its Wake still recorded the remora's chosen model, so the Wake could name a model that didn't write the answer.
9. **Answers made up their cost.** The prompt asks the model to cite what its sources cost, but the bought data didn't carry a price. The odds answer said "$0.0001" for a 0.02 USDC purchase.
10. **A self-asked answer read as the reply to the owner.** Scout's first-run answer about the Disc package landed in the thread right after the owner's question about `0x2`, with nothing saying what it answered.

## Decision
- **Sonar's check model and rule parsing:**
  - they default to `LLM_SMALL_MODEL`, else `LLM_MODEL`, never the fallback model;
  - the check schema takes any reason length, and the code keeps the first 200 characters.
- **Team files:** before validation, any YAML scalar whose source text is `0x` + hex stays the exact source string. Aliases are still not expanded (`maxAliasCount: 0`).
- **Owner transactions:** the server re-reads them for up to 12 tries, 1.5 s apart, while Tatum answers "not found". This covers every confirm: issue, team, pause, retire, budget and rotate.
- **Team import:** if the confirm still fails after the owner signed, the page keeps the digest and offers "Check again", without a new signature.
- **Room routing:** when a deterministic signal (a rule → Sentinel, a purchase → Scout) matches a template, it goes to the room's lead if the lead has that template, else to the newest remora of it.
- **A Disc that can't be read** (revoked, or not visible yet because the node lags a fresh issue):
  - the payment is blocked with `allowance.revoked` and a plain reason, and nothing is signed;
  - the remora's status doesn't change, because a lagging node must not retire a fresh remora.
- **The watcher's filter:** up to 10 watched addresses, the stream stays filtered by address. Past 10, it subscribes without a filter, and `eventsFrom` keeps only the watched addresses' balance changes. Probed on Tatum testnet: about 3 checkpoints and 38 transactions a second, which one server handles easily. A later option is one stream per 10 addresses.
- **Answers after an approval** run on the remora's model, like its own turns. The Wake records the model that actually wrote the answer, or `remora/no-model` when none did.
- **Bought data carries its price** into the prompt (`<untrusted source="reef:odds" cost="0.02 USDC">`), both for planned purchases and for the model's own `pay` calls.
- **Threads:**
  - an answer whose question isn't the owner's last line (first run, schedule) shows "Re: <question>" above it;
  - remora bubbles render Markdown with the chat's existing renderer (`features/chat/markdown.tsx`, unchanged). Real models answer in Markdown, and raw `**` read badly. The renderer doesn't pass raw HTML through, so untrusted text stays text.
- **Room failures:** a remora that fails in a room is logged as `room.remora_failed`. The facilitator logs its errors, and the merchant's 400 carries the settle error.
- **Burner:** it's topped up from the spike owner (a test key, testnet only) when low, as goal U5 already allowed. The first top-up was 0.3 SUI (`DpXwQHbvAZSvaTzjVLUcRxmiEWAC1ffBRSMsrnFbBDPB`).

## Consequences
- With a real key, every catalog model answers in Scout's turn. The room's Auto router picks with p ≥ 0.6, rule parsing reads phrasings the phrase parser can't, and Sonar's model check actually runs.
- `.env.example` documents the new `LLM_SMALL_MODEL` default.

## Links
- `apps/server/src/runtime/{brain,index,teams,remoras,rooms}.ts`, `apps/server/src/tools/pay.ts`, `apps/server/src/triggers/watch.ts`, `apps/facilitator/src/app.ts`, `packages/merchant/src/x402.ts`, `apps/web/src/features/teams/import-page.tsx`, `apps/web/src/features/threads/{lines.ts,thread-view.tsx}`
- ADR-0035 (W2 exit fixes), ADR-0042 (Grok-bots shape)
