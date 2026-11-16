# Production image (Railway, Render, any VPS with Docker)
FROM node:24-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# The SQLite database lives here - mount a persistent volume at /data
ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 3000

# `next start` listens on $PORT when the host sets it (Railway does), else 3000
CMD ["npm", "start"]
