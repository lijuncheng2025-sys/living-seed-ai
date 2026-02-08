# Living Seed AI - Cloud Brain
# Platforms: HuggingFace Spaces / Render / Railway

FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev 2>/dev/null; exit 0

COPY *.js ./
COPY *.json ./

ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

CMD ["node", "start-cloud.js"]
