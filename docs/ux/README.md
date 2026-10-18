# UX notes (W1 web, U4 first drafts)

These are drafts by Uy's agent under ADR-0027. **Huấn owns the look and the voice**, so change anything here.

- **The network switch lives in the header, always visible** ([ADR-0026](../adr/0026-network-switch.md)).
  - A loud amber **TESTNET** badge shows whenever you're not on mainnet, so nobody mistakes test money for real money.
  - Unavailable networks are greyed out with the reason in a tooltip, e.g. "remora isn't published on mainnet yet".
- **The wallet mismatch shows as a banner, not a modal.** It names the network the wallet is on and the one to switch to. Signing is still possible; the wallet refuses on its own.
- **Funds speaks in two buckets:**
  - "Ready (address balance)" is what remoras can spend;
  - "In coins → needs moving" is what they can't spend yet.
  - The primary action is one button with the amount in it: "Move $16.90 to address balance".
  - "Withdraw to coin" sits under **Advanced**, because almost nobody needs it.
  - After a move the Ready card shows "Settling…" until the balance updates (it's final within seconds).
- **The panic button** (N10) is a red "Pause all" in the header, visible whenever a wallet is connected. One tap pauses every live Disc on the network in **one** transaction. Each Disc row in Funds has its own Pause / Resume.
- **"Why?"** (N4) is a ghost button on any activity row that has a Wake. It opens a side sheet with the decision, reason, trigger, what was read, the memories used, the Sonar verdict, the model, the intent hash, and the transaction. An "anchored onchain" badge shows when `Paid.intent` matched.
- **Skeleton pages are honest:** they say "Sample remoras", and disabled actions carry a tooltip naming the wave that brings them (e.g. Approve/Reject → E4, W2).
- **Brand:** an inline-SVG fish mark (placeholder) and a teal primary. The UI kit is unchanged.
