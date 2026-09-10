# Verger: one Railway service = the desk (Next) + the agent (Python) + Mailpit.
FROM oven/bun:1 AS webbuild
WORKDIR /app/web
COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM debian:bookworm-slim
# Node for the Next standalone server, from the official image (bookworm's apt node is too old)
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv python3-pip ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/verger-venv \
 && /opt/verger-venv/bin/pip install --no-cache-dir strands-agents openai python-dotenv pillow
# Mailpit: real SMTP for the demo inbox
RUN curl -sL https://github.com/axllent/mailpit/releases/download/v1.31.1/mailpit-linux-amd64.tar.gz \
 | tar xz -C /usr/local/bin mailpit

WORKDIR /app
COPY agent/ ./agent/
COPY --from=webbuild /app/web/.next/standalone ./web/
COPY --from=webbuild /app/web/.next/static ./web/.next/static
COPY --from=webbuild /app/web/public ./web/public
RUN mkdir -p /data

ENV VERGER_DATA=/data
ENV REPO_ROOT=/app
ENV PYTHONUNBUFFERED=1
ENV PORT=3000
EXPOSE 3000

COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]
