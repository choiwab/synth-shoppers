FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/shopee/package*.json ./
RUN npm ci

COPY frontend/shopee/ .
ARG VITE_API_BASE=http://localhost:8000
ARG VITE_DASHBOARD_BASE=http://localhost:5175
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_DASHBOARD_BASE=$VITE_DASHBOARD_BASE
RUN rm -rf public/fixtures
COPY fixtures/ public/fixtures/
RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/shopee/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
