# e2e/

The Playwright suite and the injected burner test wallet (K6·e2e). [docs/e2e/README.md](../docs/e2e/README.md) covers how to run it, the env keys, and the screenshots.

- **Owner:** Huấn (`@huanngdev`); built by Uy's agent in U4 under ADR-0027 (see `docs/team-split.md` §2)
- **Status:**
  - smoke runs on desktop and Pixel 7;
  - the testnet flow covers sign in → detect → withdraw/move → pause all → resume;
  - `bun run e2e` passes 19/19.
