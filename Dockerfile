# build stage
FROM node:lts-alpine as build-stage
WORKDIR /app
# More explicit copying
COPY package.json package-lock.json ./

# Install dependencies (only rebuilds if package.json changes)
RUN npm ci

# Copy the rest of the application code
COPY . .

# dev stage
FROM build-stage as dev-stage
RUN apk update && apk add bash ffmpeg
EXPOSE 8080
CMD [ "npm", "run", "dev" ]

# debug stage
FROM build-stage as debug-stage
RUN apk update && apk add bash ffmpeg
EXPOSE 8080
CMD [ "npm", "run", "debug" ]

# production stage
FROM nginx:stable-alpine as production-stage
RUN apk update && apk add ffmpeg
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]