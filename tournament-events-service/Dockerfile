# Tournament & Events Service (Node.js 20 / Express) - port 8086
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8086
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8086
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8086/health || exit 1
CMD ["node", "server.js"]
