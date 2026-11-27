# Docker setup

The application uses a single-node MongoDB replica set for local development. Creating an order uses a transaction to save the order and reserve its ingredients together.

## Requirements

- Docker Desktop with the Linux engine
- Docker CLI

## Set up MongoDB

If you have a standalone `pizza-mongo` container with data to keep, stop it and copy its data into the replica set's volume before starting the new container. Run this migration once, with a fresh `pizza-mongo-rs-data` volume:

```powershell
docker stop pizza-mongo
docker run --rm --volumes-from pizza-mongo:ro `
  --mount type=volume,source=pizza-mongo-rs-data,target=/replica-data `
  mongo:7 sh -ec 'test ! -e /replica-data/WiredTiger && cp -a /data/db/. /replica-data/'
```

Create the replica set container:

```powershell
docker run --name pizza-mongo-rs `
  -p 127.0.0.1:27017:27017 `
  --mount type=volume,source=pizza-mongo-rs-data,target=/data/db `
  -d mongo:7 --replSet rs0 --bind_ip_all
```

Once MongoDB accepts connections, initialize the replica set once and check that the node has become primary. Start the backend when the check prints `true`.

```powershell
docker exec pizza-mongo-rs mongosh --quiet --eval 'rs.initiate({_id: ''rs0'', members: [{_id: 0, host: ''localhost:27017''}]})'
docker exec pizza-mongo-rs mongosh --quiet --eval 'db.hello().isWritablePrimary'
```

Configure this address in `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/pizza-delivery?replicaSet=rs0&directConnection=true
```

Use `directConnection=true` for the single endpoint exposed by Docker. [MongoDB Node.js driver documentation](https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/)

## Container management

Check status:

```powershell
docker ps --filter name=pizza-mongo-rs
```

Stop:

```powershell
docker stop pizza-mongo-rs
```

Start an existing container:

```powershell
docker start pizza-mongo-rs
```

View logs:

```powershell
docker logs pizza-mongo-rs
```

The `pizza-mongo-rs-data` volume stores the database and replica set configuration across container restarts and removal. If you recreate the container with that volume, wait for the node to become primary before starting the backend.

## Docker Desktop

Docker Desktop must be running before Docker commands. After launching Docker Desktop, verify the engine:

```powershell
docker info
```
