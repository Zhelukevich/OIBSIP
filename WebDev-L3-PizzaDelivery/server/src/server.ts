import "./env.js";
import { once } from "node:events";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { ConfigurationError, getServerConfig } from "./config.js";
import { startLowStockJob } from "./jobs/lowStock.js";
import { logFailure } from "./middleware/errors.js";
import { Inventory } from "./models/Inventory.js";
import { User } from "./models/User.js";
import { attachOrderSockets } from "./realtime/orders.js";
import { seedAdministrator, seedInventory } from "./services/seed.js";

async function start() {
  const { port, clientOrigin, mongoUri } = getServerConfig();
  await mongoose.connect(mongoUri);
  await Promise.all([User.init(), Inventory.init()]);
  await seedAdministrator();
  await seedInventory();

  const app = createApp(clientOrigin);
  const httpServer = createServer(app);
  const io = attachOrderSockets(httpServer, app, clientOrigin);
  const listening = once(httpServer, "listening");
  httpServer.listen(port);
  await listening;
  const stopStockJob = startLowStockJob();
  console.log(`Server listening on port ${port}`);

  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => {
      console.error("Server shutdown timed out");
      process.exit(1);
    }, 10_000);
    try {
      await Promise.all([io.close(), stopStockJob()]);
      await mongoose.disconnect();
    } catch (error) {
      logFailure("Failed to shut down server", error);
      process.exit(1);
    } finally {
      clearTimeout(timeout);
    }
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    console.error(error.message);
  } else {
    logFailure("Failed to start server", error);
  }
  process.exit(1);
});
