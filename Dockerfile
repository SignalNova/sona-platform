# ─── SONA Platform - Hugging Face Spaces Dockerfile ───
# Uses Next.js standalone output for minimal Docker image

FROM node:20-slim

# Install runtime dependencies for native modules (canvas, sharp)
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    libvips42 librsvg2-2 libcairo2 libjpeg62-turbo libpng16-16 \
    libpango-1.0-0 libpangocairo-1.0-0 libgif7 \
    openssl curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install ALL dependencies (dev needed for build)
RUN npm install --legacy-peer-deps 2>&1

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (with standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Remove devDependencies after build to save space
RUN npm prune --omit=dev 2>&1

# HF Spaces uses port 7860
ENV PORT=7860
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

EXPOSE 7860

CMD ["./entrypoint.sh"]
