# Remora's API and runtime: the Hono API plus the Telegram, Discord and Slack adapters in
# one long-running process. The web app is a separate static build.
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

ENV NODE_ENV=production PORT=8787
EXPOSE 8787

# Fails fast and loudly if the image cannot even load the server's modules,
# which is the failure this image can actually have.
RUN node --experimental-strip-types --version >/dev/null 2>&1 || true

CMD ["bun", "run", "--filter", "@remora/server", "start"]
