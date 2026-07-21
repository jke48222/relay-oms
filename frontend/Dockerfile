# Build the static SPA, then serve it from nginx — which also proxies /api
# and /socket to the backend service, exactly like the Vite dev proxy does
# locally. One origin, no CORS, in every environment.
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS app

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
