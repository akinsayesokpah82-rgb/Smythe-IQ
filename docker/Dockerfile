FROM node:18-slim
WORKDIR /app
COPY backend/package*.json ./backend/
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY backend/ ./backend
WORKDIR /app/backend
RUN npm install --production
EXPOSE 4000
CMD ["node", "server.js"]
