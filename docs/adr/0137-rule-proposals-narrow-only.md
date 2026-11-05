# ADR-0137: Rule proposals from outcomes; a rule can only narrow spending

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- Budget proposals (ADR-0124) taught a remora to propose its own limit. Owners also rate answers
  (👍/👎) and decline over-limit payments, but nothing turned a pattern of those into a standing rule.

## Decision
- **A daily heartbeat** per remora that buys answers (a chained `rules.heartbeat` job, and "Check
  now"), reading the last 14 days:
  - at least 3 answers rated noise that bought one service: propose `skip` it unless the question
    names a shape every useful answer from it had and no noisy one did (from the one rule-based
    classifier, `shapesOf`); with no such shape, `ask` before buying it;
  - at least 2 declined over-limit payments to one payee: `ask` before buying it.
- **A proposal** is an `approvals` row (kind `rule`, `payload.kind = "planner_rule"`) with a
  structured `PlannerRule` (`skip` | `ask` | `prefer`, a service, `when` shapes), the line written
  from the structure, a one-line reason from the model (with a fallback), and 2–5 cited memories (the
  service's track-record notes). With fewer than 2 to cite, none is made. One open at a time; a
  declined rule is remembered and the same rule waits 7 days.
- **A rule can only narrow spending:** `skip` and `ask` spend less or ask more, and `prefer` only
  reorders services already planned (one naming a service the remora can't buy is refused). So
  accepting is a tap, not a signature. Anything that could spend more stays a budget proposal.
- **Accepted:** into `config.rules` through `saveConfig` (config history shows it, and restores it
  directly), and written as a `[rule]` memory in `feedback` that cites the outcomes. The planner
  applies it before buying (ADR-0136). Remove is in the rule card.
- Sentinel's muted pings already become ignore rules on the 🔕 itself (N19), so the heartbeat doesn't
  propose them again.

## Consequences
- No schema change: rules live in the config, proposals in `approvals`, events in `remora_events`.
- The rule card sits under the budget card on a Researcher's overview.

## Links
- ADR-0124 (budget proposals), ADR-0136 (memory narrows the plan), ADR-0134
