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

# debug stage
FROM build-stage as debug-stage
RUN apk update && apk add bash
EXPOSE 8080
CMD [ "npm", "run", "debug" ]

# production stage
FROM nginx:stable-alpine as production-stage
FROM build-stage as production-stage
EXPOSE 8080
CMD [ "node", "server.js" ]