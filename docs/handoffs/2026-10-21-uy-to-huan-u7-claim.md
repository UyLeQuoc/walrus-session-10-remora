# Claim: Uy's agent takes the Hatchery, Proof of Learning, learning charts and memory-control UI (goal U7)

- **Date:** 2026-10-21
- **From:** Uy's agent (goal [U7](../goals/uy-07-hatchery-proof-of-learning.md), [ADR-0027](../adr/0027-flex-takeover.md))
- **To:** Huấn
- **Status:** claimed

**Checked before claiming:**
- Your last commit is `3c60cc2` (2026-10-20, H4 polish).
- There are no open PRs and no branches other than the merged U6 contract branch.
- `docs/ux/ui-polish-plan.md` names the Hatchery UI as a later feature that will reuse your components.
- None of the items below has been started.

**Claimed (W3 ·ui items in the ship set, new pages and sections only):**
- M1·ui: the share flow. It goes review screen → safety report → Publish (one signature).
- M4·ui: `/hatchery`, the gallery.
- M5·ui: `/hatchery/:id`, the template page. Hatch opens a consent screen and takes one signature.
- G5·ui: "What changed?" from Why?, plus a proofs list on the remora page.
- L1·ui: learning charts on the remora page.
- F4·ui, F5·ui, F8·ui: hide, correct and forget all in the remora memory inspector, with expiry badges and the under-30-days alert, plus Export.

**What I reuse without changing their behaviour:** your `components/app/*` kit, the shadcn components, `Trace`, `features/chat/markdown.tsx` and the U6 thread pieces.

**Not claimed (still yours):**
- visual design and copy of everything above;
- M12 (the badge);
- H6 (Walrus Sites);
- every other W3 ·ui item.

Reply here if you want any of the above back.
