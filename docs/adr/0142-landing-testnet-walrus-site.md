# ADR-0142: The landing as a testnet Walrus Site (D5), published with Mysten's release binaries

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md))

## Context
- **D5 of U19:** publish `apps/landing` as a Walrus Site on testnet (H6). The landing was already built
  for Walrus Sites ([ADR-0092](0092-landing-page.md)), but it was never published. The mainnet step
  was left for Uy.
- **wal.app serves mainnet sites only.** A testnet site opens through a self-hosted portal. Mainnet costs
  real WAL and SUI, and we build on testnet first ([ADR-0024](0024-testnet-first.md)).
- **The tools aren't package dependencies.** `site-builder` and `walrus` are Mysten's CLIs. They talk to
  Sui and Walrus themselves.
- **Sui access is gRPC only** ([ADR-0021](0021-sui-grpc-only.md)). site-builder 2.12.0 moved off
  JSON-RPC-only client methods (walrus-sites #725). Its `--dry-run` still calls JSON-RPC
  `dev_inspect`, which public fullnodes no longer serve.
- **Testnet epochs last one day.** With `--epochs 2`, the site would expire at the start of epoch 574
  (Nov 6, 22:50 UTC). That is before the code freeze on Nov 7 at 18:00.

## Decision
- **A committed `apps/landing/ws-resources.json`:**
  - `site_name` "Remora";
  - `metadata` (link and image on getremora.vercel.app, the repo, creator);
  - per-file `headers`: `Content-Type`, and `Cache-Control: no-cache` on `index.html` and
    `config.js`, one day on images, the poster and the video;
  - one route, `/about` → `/index.html`, the same as the web app;
  - no `object_id`, so the file works on either network.

  `build.ts` copies it into `dist/` and keeps headers only for files that this build has. The demo
  video and its poster ship only when they have been rendered.
- **The tools,** from Mysten's GitHub releases (macOS arm64). They run from a scratch directory and are
  not installed system-wide or committed:
  - `site-builder` 2.12.2 (`7c5dfaf4ed2a`, release `mainnet-v2.12.2`);
  - `walrus` 1.60.1 (`18655f831b8a`, release `testnet-v1.60.1`);
  - the portal image `mysten/walrus-sites-server-portal:mainnet-v2.12.2`, which matches `site-builder -V`.

  We never use `--dry-run`.
- **A throwaway wallet.**
  - The Sui client config, the keystore, the Walrus client config and `sites-config.yaml` live in the
    scratch directory. `~/.sui` and `~/.config/walrus` are never touched.
  - `SPIKE_OWNER_KEY` (15.36 SUI) goes into the keystore through a script that reads it from the
    environment, so it is never on a command line or printed.
- **Address-balance gotcha:**
  - SPIKE_OWNER's SUI was all in its address balance, with no `Coin<SUI>` objects. `walrus get-wal`
    failed with "could not find SUI coins with sufficient balance", because the CLI selects coin
    objects.
  - The fix was one gRPC transaction, `coin::redeem_funds(tx.withdrawal(1.5 SUI))` to itself, which
    made a coin: tx `9dYPA5GSoQFbSoi5ENs8pcr61215krCaxdwwjYyYz3hz`. The balance checks also used
    `packages/chain`'s gRPC client.
- **Published for 5 epochs,** the spec's upper bound (1 to 5), not 2, so the site outlives the code
  freeze:
  - **Command:** `site-builder --context=testnet deploy apps/landing/dist --epochs 5`.
  - **Site object:** `0x3676fbefa46e4b68d43a6aa7f7fa1299d8716bbace3fc482498946913f3f505e` (base36
    `1cvaedpnormve223nxfp69d28nsqnsmw2aeolmx912ar3vdmxq`), created in tx
    `FWoUndb1tRQb7GPfN5gbrvh2bw6DYWGPBaijMuNTUXps`.
  - **Storage:** one quilt (13 files, 1,336,668 bytes), blob `EiKXuAYsJ12256OHtxOBour9JTf4nqC9IOCr6-bnwTI`,
    blob object `0x6f89aeb0…1406`. It was certified in tx `AB6TQEyESVuDgk3HUEtW5mHAKpy185tKuMQu7ymruD3A`
    and stored until the end of epoch 577 (about Nov 9, 22:50 UTC).
- **The check:**
  - **Portal:** the official portal on `127.0.0.1:8900`, with the settings from walrus-sites'
    `local-docker-portal.sh testnet`. The script itself always binds port 3000.
  - **Files:** all 13 came back byte-identical to `dist/`, with the headers we set. `/about` returns
    the page, and an unknown path returns 404.
  - **Cold reads:** a file's first read sometimes gave 503, because the public testnet aggregator
    took more than the portal's 10 s. A retry worked.
  - **Screenshots:** headless Chromium at 1440 and 390 px shows the page with its shader.
- **The README says it plainly:** "a testnet Walrus Site; wal.app serves mainnet only, so open it
  through a local portal". It also gives the object id, Suiscan links, the portal command, and how to
  update the site.
- **What it cost:**
  - SPIKE_OWNER went from 15.357887130 to 15.182677077 SUI, so 0.175 SUI. Of that, 0.1 SUI was
    exchanged for 0.1 WAL, and gas and storage deposits came to about 0.075 SUI.
  - Storage used 0.00167 WAL. 0.0983 WAL is left.

## Consequences
- **Anyone can check the site:** the object on a testnet explorer, and the page through a local portal.
  Judges need Docker for the portal. We don't point anyone at a third-party testnet portal.
- **No demo video on the Walrus Site yet:**
  - this worktree has no rendered video (`docs/launch/demo/out` is gitignored);
  - getremora.vercel.app serves none either: `/media/remora-demo.mp4` returns the app's HTML;
  - so the section shows its fallback, and the poster and video return 404 on the portal.

  Render the video, then update the site to include it.
- **Expiry:** the testnet storage ends with epoch 577. To keep the site up for judging, run
  `site-builder --context=testnet update --epochs <n> apps/landing/dist <site-id>` or `walrus extend`
  before Nov 9.
- **For Uy's list:**
  - a mainnet site on wal.app with a SuiNS name. It needs mainnet WAL and SUI (ADR-0024).
    `apps/landing/README.md` has the commands;
  - extend the testnet storage if judging runs past Nov 9.

## Links
- Spec: `docs/goals/uy-19-it-gets-better.md` §D5.
- [ADR-0092](0092-landing-page.md) (the landing), [ADR-0100](0100-landing-and-app-one-site.md) (one site
  with the app), [ADR-0021](0021-sui-grpc-only.md), [ADR-0024](0024-testnet-first.md).
- `apps/landing/README.md`, `apps/landing/ws-resources.json`.
- Walrus Sites docs: <https://docs.wal.app/docs/sites/configuration/site-configuration>.
