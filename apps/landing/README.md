# apps/landing

This is the landing page (H6, [ADR-0092](../../docs/adr/0092-landing-page.md)). It is one static
page, built for Walrus Sites. Since [ADR-0102](../../docs/adr/0102-landing-v2-live-shader.md) it's dark, around a live WebGL
sea (a fragment shader in `public/index.html`, no library) with the app's faces swimming in it.

- **Owner:** H6 is Huấn's lane. Uy's agent built this version when Uy asked (ADR-0087). See
  `docs/team-split.md` §2.
- **Build.** `bun run --filter @remora/landing build` writes `dist/`. It contains:
  - the page, `public/screens/` (real screens from the Nov 3 testnet runs, with the faces and the plain words) and the share image;
  - `ws-resources.json`;
  - the demo video and its poster, when `bun docs/launch/demo/render.ts` has rendered them.
- **Preview.** `open apps/landing/dist/index.html`.
- **Config.** `public/config.js` holds the deployed app's URL and the blog's URL. Until they are set,
  the buttons open the repo's "Try it".

## Live with the app ([ADR-0100](../../docs/adr/0100-landing-and-app-one-site.md))

The web app's Vercel build runs `bun ../landing/build.ts --into dist`, so <https://getremora.vercel.app> serves this page at `/` to signed-out visitors and at `/about`. In that build `config.js` points the buttons at the same origin. Deploying the web deploys it; the demo video comes from the deploying machine, so render it first when it changes.

## On Walrus Sites: a testnet site ([ADR-0142](../../docs/adr/0142-landing-testnet-walrus-site.md))

**This page is a testnet Walrus Site. wal.app serves mainnet only, so open it through a local portal.**

- **Site object:** [`0x3676fbefa46e4b68d43a6aa7f7fa1299d8716bbace3fc482498946913f3f505e`](https://suiscan.xyz/testnet/object/0x3676fbefa46e4b68d43a6aa7f7fa1299d8716bbace3fc482498946913f3f505e)
  (base36 `1cvaedpnormve223nxfp69d28nsqnsmw2aeolmx912ar3vdmxq`). It was created in tx
  [`FWoUndb1…TUXps`](https://suiscan.xyz/testnet/tx/FWoUndb1tRQb7GPfN5gbrvh2bw6DYWGPBaijMuNTUXps).
- **Its files:** one quilt, blob `EiKXuAYsJ12256OHtxOBour9JTf4nqC9IOCr6-bnwTI`
  ([blob object](https://suiscan.xyz/testnet/object/0x6f89aeb0c1714557b3c0b2bd01e2d1baccc0cb4eba92a1d238890740b5961406)).
  It is stored until the end of Walrus testnet epoch 577 (about Nov 9, 2026, 22:50 UTC).
- **Open it.** Run the official portal image (its tag must match `site-builder -V`) on port 8900. Then
  open <http://1cvaedpnormve223nxfp69d28nsqnsmw2aeolmx912ar3vdmxq.localhost:8900>:

  ```bash
  docker run --rm -p 127.0.0.1:8900:3000 \
    -e SUINS_CLIENT_NETWORK=testnet \
    -e SITE_PACKAGE=0xf99aee9f21493e1590e7e5a9aea6f343a1f381031a04a732724871fc294be799 \
    -e LANDING_PAGE_OID_B36=1p3repujoigwcqrk0w4itsxm7hs7xjl4hwgt3t0szn6evad83q \
    -e ENABLE_ALLOWLIST=false -e ENABLE_BLOCKLIST=false -e B36_DOMAIN_RESOLUTION_SUPPORT=true \
    -e RPC_URL_LIST=https://fullnode.testnet.sui.io:443 \
    -e PREMIUM_RPC_URL_LIST=https://fullnode.testnet.sui.io:443 \
    -e AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space \
    mysten/walrus-sites-server-portal:mainnet-v2.12.2
  ```

  These are the settings from `scripts/local-docker-portal.sh testnet` in
  [walrus-sites](https://github.com/MystenLabs/walrus-sites); that script always uses port 3000. A file's
  first request can take a moment (503) while the testnet aggregator warms up. Reload the page.
- **Deploy or update it** with `site-builder` 2.12.2 and `walrus` 1.60.1 (Mysten's release binaries). Use
  a testnet wallet that holds a SUI coin object and a little WAL (`walrus get-wal --context testnet`):

  ```bash
  bun run --filter @remora/landing build     # dist/ with ws-resources.json (headers, the /about route, metadata)
  site-builder --context=testnet deploy apps/landing/dist --epochs 5 \
    --object-id 0x3676fbefa46e4b68d43a6aa7f7fa1299d8716bbace3fc482498946913f3f505e
  ```

  Without `--object-id`, `deploy` creates a new site. It writes the new id into `dist/ws-resources.json`,
  and the build overwrites that file, so copy the id here. The committed
  [`ws-resources.json`](ws-resources.json) has no `object_id`, so it works on either network.

## A mainnet site (Uy's step: costs mainnet WAL and SUI, ADR-0024)

```bash
bun run --filter @remora/landing build
site-builder --context=mainnet deploy apps/landing/dist --epochs 53   # prints the site object id
```

Then point a SuiNS name at the site object, so it serves at `<name>.wal.app`. Link it from the README
and the form.
