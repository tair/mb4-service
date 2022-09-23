# build stage
FROM node:lts-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install --package-lock-only
RUN npm install
COPY . .

# dev stage
FROM build-stage as dev-stage
RUN apk update && apk add bash
EXPOSE 8080
CMD [ "npm", "run", "dev" ]

# production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]