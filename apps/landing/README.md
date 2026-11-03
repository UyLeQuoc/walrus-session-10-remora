# apps/landing

This is the landing page (H6, [ADR-0092](../../docs/adr/0092-landing-page.md)). It is one static
page in the app's design system, built for Walrus Sites.

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

## Publish to Walrus Sites (Uy's step: mainnet, costs WAL)

```bash
bun run --filter @remora/landing build
site-builder --context=mainnet publish apps/landing/dist --epochs 53   # prints the site object id
# later updates:
site-builder --context=mainnet update apps/landing/dist <site-object-id> --epochs 53
```

Then point a SuiNS name at the site object, so it serves at `<name>.wal.app`. Link it from the README
and the form.
