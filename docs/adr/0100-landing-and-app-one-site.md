# ADR-0100: The landing page and the app are one site: getremora.vercel.app shows the landing to signed-out visitors at /

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Uy Le (asked for the landing page in the deploy, then: "I'd still rather it be one
  app, the landing page and the app"), Uy's agent

## Context
- [ADR-0092](0092-landing-page.md) built `apps/landing` for Walrus Sites.
  - The publish is Uy's step on mainnet, and it costs WAL.
  - It hasn't happened, so there was no public landing page.
- The app went live on Nov 3 at <https://getremora.vercel.app>
  ([ADR-0099](0099-first-deploy-one-railway-service.md)).
- **A first try served the landing page from a second Vercel project.** Uy wanted one site instead,
  so that project is deleted.
- In the app, `/` is Home: a dashboard when signed in, and a short welcome when signed out.

## Decision
- **One Vercel project, `getremora`, serves both.**
  - The web build moves the app's `index.html` to `app.html`.
  - `bun apps/landing/build.ts --into dist` then adds `landing.html`, its `config.js`, `screens/`
    and `media/` (the demo video). The app's own favicon and share image stay.
- **Routing, in `apps/web/vercel.json`:**
  - `/` serves the landing page when the `remora_session` cookie is missing. It serves the app when
    the cookie is present, so a signed-in owner lands on their dashboard.
  - `/about` always serves the landing page, for links from the form and the posts.
  - Every other path serves the app, as before.
  - Inside the app, the rail's Home link still opens the app's Home, because it's client-side.
- **The landing's buttons stay on the same origin.**
  - In this build, `config.js` sets `app` to `location.origin`.
  - "Try Scout" opens `/playground`, and "App" opens `/chat`. `/` would only show the landing again.
- **The standalone build (`dist/` for Walrus Sites) is unchanged.**
  - Its `config.js` points at <https://getremora.vercel.app>.
  - Walrus Sites stays the planned mirror, still Uy's step.
- **The deployed smoke test knows about it.** Against `E2E_BASE_URL`, `/` is checked as the landing
  page (with `/about`). Locally `/` is still the app.

## Consequences
- **There's one URL for everything.**
  - The form's "Working demo" and "Additional documentation" can both use
    <https://getremora.vercel.app>.
  - <https://getremora.vercel.app/about> is the page to link.
- **A signed-out visitor on `/` never sees the app's own welcome.** The landing page replaces it.
  Inside the app it's still there.
- **The page shows what was rendered when the web was last built.**
  - Its screens and video still show the letter avatars from before
    [ADR-0098](0098-remora-faces-with-moods.md).
  - Rebuild and redeploy the web after a new capture.
- **The landing's GitHub links 404 for visitors until the repo goes public on Nov 9**
  ([ADR-0017](0017-github-repo-private-until-submission.md)).

## Links
- [ADR-0092](0092-landing-page.md) · [ADR-0099](0099-first-deploy-one-railway-service.md) ·
  [apps/landing](../../apps/landing/README.md) · [deploy runbook](../deploy.md)
