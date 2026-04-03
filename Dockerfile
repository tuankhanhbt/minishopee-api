FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/uploads/categories /app/uploads/products

EXPOSE 3000

CMD ["npm", "start"]
