FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx next build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3470
# Apply migrations and make sure reference data and users exist, then serve.
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx next start --port 3470"]
