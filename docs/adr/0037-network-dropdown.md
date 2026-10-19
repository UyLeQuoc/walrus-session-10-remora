# ADR-0037: Network dropdown instead of a toggle plus a badge

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Huấn

## Context
ADR-0026 put a network switch in the header and kept "nobody mistakes test money" as a hard rule. The
UI it grew was a loud amber **TESTNET** badge next to a `ToggleGroup` of two buttons — about 230px of
header. On a 390px screen that pushed the page title off the edge (`Remor…`). The switch also spent
its width re-stating the available networks on every page.

This ADR is the **UI part of ADR-0026**. It changes only how the switch looks and behaves; the
decision "one deployment, two networks, chosen per session via `x-remora-network`" is untouched.

## Decision
- Replace `NetworkSwitch` with **`NetworkSelect`**: a single 32px `DropdownMenu` trigger showing a
  status dot (warning for testnet, success for mainnet), the current network's name, and a chevron.
- The `data-testid="testnet-badge"` moves onto the trigger when the network is testnet, so the smoke
  test keeps working (or the test moves to the menu item, plan §7.2).
- An unavailable network (mainnet until Uy publishes it) is a `menuitemradio` that is **disabled**,
  with the reason written under its name ("Not published yet").
- **ADR-0026's intent is preserved** without the badge: the warning dot is always coloured and the
  word "Testnet" is always visible in the trigger, so test money is still obviously test money.

## Consequences
- The header keeps one consistent set of 32px controls (menu, network, pause) at every width.
- The smoke test's "mainnet is offered but disabled" moves from `getByRole("radio")` to
  `getByRole("menuitemradio")`; that edit lands in the same commit.
- `ToggleGroup` is no longer used by the header.

## Links
- [ADR-0026](0026-network-switch.md) (superseded in UI only) · [ADR-0036](0036-ui-foundation.md) ·
  `apps/web/src/features/network/`
