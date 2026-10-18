# Handoff: Uy → Huấn, network switch in the UI (A9·ui)

- **Date:** 2026-10-19 · **From:** Uy · **To:** Huấn · **Status:** open
- **Decision:** [ADR-0026](../adr/0026-network-switch.md). One deployment serves testnet and mainnet; the UI picks the network per session.

**What the UI needs:**

1. **A switch in the header** (testnet ↔ mainnet). Keep the choice in `localStorage` (a per-viewer convenience).
   - Show a loud **TESTNET** badge while on testnet.
   - Fetch `GET /api/networks`. Disabled networks are greyed out with a hint ("mainnet launches soon"). Until Uy's mainnet pass, only testnet is available.
2. **Send `x-remora-network: <network>` on every API call.** Put it in the shared fetch wrapper.
3. **Wallet sync:** set dapp-kit's network to the same one. If the connected wallet is on the other network, show a blocking hint ("switch your wallet to testnet").
4. **What switching changes:**
   - it refetches remoras, Discs, funds (Detect funds) and activity, all of which are per network;
   - memory views don't change, since memory is always mainnet.
5. **The browser chain client** is gRPC-web at `https://fullnode.<network>.sui.io:443`, and IDs come from `@remora/schema` `DEPLOYMENTS[network]`.

**Contract:** `Network`, the header name and the `/api/networks` response shape land in `packages/schema` through U3's contract PR. Build against the fixtures until then.
