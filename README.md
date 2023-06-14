# mb4-service

This template aims at helping you started developing with NodeJS + Express for the MorphoBank Service Application.

### Configure Local Environment File for Development
#### Configure for the Local Database
```sh
cp db-dev/development.env.template db-dev/.env
```
Then fill in all the variable values

#### Configure for the NodeJS Application
```sh
cp development.env.template .env
```
Then fill in all the variable values. Note the database DB_USER and DB_PASSWORD value shall be the same as the value we defined in the db-dev/.env file for the local database


### Compile and Hot-Reload for Development With Container
The service container is accessible on **http://localhost:8080/**
The database container is accessible on **http://127.0.0.1:3306/**

#### Start the container
```sh
docker-compose -f docker-compose.dev.yml up
```

#### Rebuild when .env file gets updated
```sh
docker-compose -f docker-compose.dev.yml up --build
```

#### Force rebuild when package.json or package-lock.json file gets updated
```sh
docker stop mb4-service-container-dev
docker rm mb4-service-container-dev
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```


### Load Sample Data to the Development Database Container
```sh
mysql -h 127.0.0.1 -u morphobank -p morphobank < {database_dump_file}
```
Then enter the password you defined in the db-dev/.env file


### Connect to the Development Database
```sh
mysql -h 127.0.0.1 -u morphobank -p 
```
Then enter the password you defined in the db-dev/.env file


### Compile and Hot-Reload for Development on Local with Shared Network Container
Before launching the application, make sure you've created a shared network as instructed in mb4-proxy project
The service container is accessible on **http://localhost:81/services/** and **http://localhost:8080/**
The database container is accessible on **http://127.0.0.1:3306/**

#### Start the container
```sh
docker-compose -f docker-compose.local.yml up
```

#### Rebuild when .env file gets updated
```sh
docker-compose -f docker-compose.local.yml up --build
```

#### Force rebuild when package.json or package-lock.json file gets updated
```sh
docker stop mb4-service-container-dev
docker rm mb4-service-container-dev
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up
```

### Run database migration
#### Config sequelize parameters
```sh
cp config/config.json.template config/config.json
```
Then fill in all the variable values

#### Run migration
```sh
docker exec -it mb4-service-container-dev /bin/bash
npx sequelize-cli db:migrate
```

### Configure Local Environment File for Production
#### Configure for the NodeJS application
```sh
cp production.env.template .env
```
Then fill in all the variable values


### Compile and Minify for Production (TBD)
```sh
npm run build
```


### Compile and Minify for Production With Container - Build Only (TBD)
```sh
docker build -t mb4-service:<version_number> .
```


### Compile and Minify for Production With Container - Host As a Server (TBD)
The container is accessible on **http://localhost:4001/**

```sh
docker-compose up --build
```