# Remora's backend in one container (ADR-0099): the Hono API with the Telegram, Discord and Slack
# adapters, the x402 facilitator and gas station, and the demo merchants, as three processes that
# reach each other on localhost (scripts/railway-start.mts). The web app is a separate static build.
#
# Deliberately not a multi-stage build with a compile step: the server runs
# TypeScript through tsx, so there is no artefact to copy out. Deliberately no
# typecheck or tests either; CI runs those on every push, and re-running them
# here only makes a deploy fail for reasons a deploy cannot fix.
FROM oven/bun:1.3.14 AS bun

# Every workspace's package.json and nothing else. A hand-kept list went stale as workspaces were
# added, and `--frozen-lockfile` then refused to install (ADR-0056). The output is identical when
# only sources change, so the install layer below stays cached.
FROM node:24-slim AS manifests
WORKDIR /src
COPY . .
RUN mkdir /out && find . -name package.json -not -path "*/node_modules/*" -exec cp --parents {} /out \;

FROM node:24-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Manifests first, so a change to source does not re-resolve the dependency graph.
COPY bun.lock package.json turbo.json tsconfig.base.json ./
COPY --from=manifests /out ./
RUN bun install --frozen-lockfile

COPY packages packages
COPY apps/server apps/server
COPY apps/facilitator apps/facilitator
COPY apps/merchants apps/merchants
COPY scripts/railway-start.mts scripts/railway-start.mts
# ADR-0117: the dated load runs, which /api/stats shows as they were measured.
COPY docs/spikes/*-u17-load.json docs/spikes/

ENV NODE_ENV=production PORT=8787
EXPOSE 8787

# Fails fast and loudly if the image cannot even load the server's modules,
# which is the failure this image can actually have.
RUN node --experimental-strip-types --version >/dev/null 2>&1 || true

CMD ["node", "scripts/railway-start.mts"]
