# Frontend Angular : build Node puis service statique par nginx (port 80)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/sportbook-web/browser /usr/share/nginx/html
EXPOSE 80
