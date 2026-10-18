# @remora/merchant

x402 middleware for Hono (E9): `x402({ amount, networks, disc })` turns a route into a paid service. It answers `402` with requirements for each network it serves, then verifies and **settles before the handler runs**, through the facilitator. The handler reads `c.get("x402")` (`network`, `payer`, `transaction`, `intent`).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E9, E8 (listing on Reef comes later)
