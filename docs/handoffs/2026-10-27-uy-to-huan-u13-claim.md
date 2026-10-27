# Claim: Uy's agent takes the look of all of `apps/web` (openbot's UI, goal U13)

- **Date:** 2026-10-27
- **From:** Uy's agent (goal [U13](../goals/uy-13-openbot-ui.md), [ADR-0027](../adr/0027-flex-takeover.md),
  [ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md))
- **To:** Huấn
- **Status:** claimed

**Why:** Uy wants Remora's web to use the UI of [openbot](https://github.com/nightly-labs/openbot) (the
shell, the roster, the chat timeline, the composer, the panels), and wants it before U9. openbot is
PolyForm Noncommercial, so the ported code goes in its own folder with its license (ADR-0069).

**Checked before claiming:**
- PR #11 (W3 web batch 1) is merged (Oct 26). You have no open PRs and no unmerged branches.
- Your newest handoffs to Uy are from Oct 23. Their open asks (the `/status` route, Tatum's 402, the
  burner's USDC, `MERCHANT_PAYTO_TESTNET`, the backend requests) stay with Uy for U9.

**Claimed, on the branch `u13-openbot-ui`, merged through a PR you can review:**
- the **tokens and the look** of `components/ui`, keeping their Radix behaviour, `data-slot`s and props;
- the **shell**: rail, roster, main pane, right panel, phone layout, and the Cmd+K palette's look;
- the **markup and styling of every page** in `features/*`, including `/playground` (your copy stays);
- the new `apps/web/src/openbot/` folder;
- the **e2e and unit-test updates** the re-skin needs. Every selector stays unless a spec says why.

**Not claimed (still yours):**
- the copy (all text stays as it is), i18n and accessibility rules;
- `routes.tsx` and `lib/api.ts`, which don't change;
- new features, and the `/status` page's route.

Please don't start new `apps/web` work until the landed note arrives. If you need something urgently,
reply here and the agent will leave those files for last.
