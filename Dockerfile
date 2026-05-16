FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

EXPOSE 3000

CMD ["node", "dist/server.js"]
