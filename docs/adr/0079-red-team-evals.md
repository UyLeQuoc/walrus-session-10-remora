# ADR-0079: The red-team evals: 28 attacks, deterministic in CI

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- U9 Phase C (I3) asks for `bun run evals` with at least 20 injection attacks.
  - Each attack names the layer that stopped it.
  - Each reports the money moved, which must be 0.
  - The deterministic layers run in CI, and the result is published in the README and the threat model.
- `evals/mcp-attacks.json` already held 10 agent attacks (F14), with a CI test.

## Decision
- **Two more suites, as fixtures with a test each:**
  - **`evals/payment-attacks.json` (12 attacks).** Each is the payment an obedient model would make after
    reading injected text. It runs through Sonar's deterministic `policyCheck` with a live-looking Disc.
    Every attack must come back `block` or `ask`, and a control purchase must still be `allow`.
  - **`evals/template-attacks.json` (6 attacks).** Each is a poisoned team file. It runs through the
    Hatchery's safety review and must be blocked by the named check.
- **`bun run evals`** runs the three suites (28 attacks), then prints a table by layer and "28 attacks,
  0 overspends". CI already runs the suites in `bun run test`.
- **The model and onchain layers stay on demand.**
  - The check model can only tighten, so the deterministic result doesn't depend on it.
  - The Disc's onchain abort is already recorded (`7NYf3…`, `EPayeeNotAllowed`), and
    `spikes/w2/injection.ts` reruns it on testnet.

## Consequences
- **The README and the threat model can say "28 attacks, 0 overspends"** and point at a command anyone
  can run.
- **A change to Sonar's policy or the safety review that lets one through fails CI.**
- **These suites don't call a model.** A prompt that fools the model is the case the design already
  assumes: the obedient fake model in `runtime.test.ts` obeys every injection, and the policy and the
  Disc have to stop it.

## Links
- [evals/README.md](../../evals/README.md) · [threat-model.md](../threat-model.md) ·
  [ADR-0067](0067-mcp-v2-details.md) · [U9 goal](../goals/uy-09-testnet-launch.md) Phase C
