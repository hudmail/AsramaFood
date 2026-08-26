FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

<<<<<<< HEAD
VOLUME ["/app/data", "/app/public/uploads"]
=======
VOLUME ["/app/data"]
>>>>>>> 9055762d63d710105a6297457545a0cdb76182ce
EXPOSE 3000

CMD ["node", "server.js"]
