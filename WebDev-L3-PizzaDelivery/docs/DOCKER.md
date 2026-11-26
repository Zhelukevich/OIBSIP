# Docker setup

The application uses Docker for the local MongoDB database.

## Requirements

- Docker Desktop with the Linux engine
- Docker CLI

## Start MongoDB

Run from any directory:

```powershell
docker run --name pizza-mongo `
  -p 27017:27017 `
  -e MONGO_INITDB_DATABASE=pizza-delivery `
  -d mongo:7
```

The database is available at:

```text
mongodb://127.0.0.1:27017/pizza-delivery
```

Configure this address in `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/pizza-delivery
```

## Container management

Check status:

```powershell
docker ps --filter name=pizza-mongo
```

Stop:

```powershell
docker stop pizza-mongo
```

Start an existing container:

```powershell
docker start pizza-mongo
```

View logs:

```powershell
docker logs pizza-mongo
```

Remove the container:

```powershell
docker rm -f pizza-mongo
```

Removing the container removes its local database data. Add a volume before production or when data must survive container removal:

```powershell
docker run --name pizza-mongo `
  -p 27017:27017 `
  -e MONGO_INITDB_DATABASE=pizza-delivery `
  -v pizza-mongo-data:/data/db `
  -d mongo:7
```

## Docker Desktop

Docker Desktop must be running before Docker commands. After launching Docker Desktop, verify the engine:

```powershell
docker info
```
