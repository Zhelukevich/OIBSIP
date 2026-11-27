import assert from "node:assert/strict";
import test from "node:test";
import { ConfigurationError, getServerConfig } from "../../dist/config.js";

function setEnvironment(t, values) {
  for (const [name, value] of Object.entries(values)) {
    const previous = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}

test("development can start with local defaults", (t) => {
  setEnvironment(t, {
    NODE_ENV: "development", JWT_SECRET: undefined, CLIENT_URL: undefined, MONGODB_URI: undefined, PORT: undefined,
  });

  assert.deepEqual(getServerConfig(), {
    port: 5000,
    clientOrigin: "http://localhost:5173",
    mongoUri: "mongodb://127.0.0.1:27017/pizza-delivery?replicaSet=rs0&directConnection=true",
  });
});

test("production requires explicit credentials and endpoints", (t) => {
  setEnvironment(t, {
    NODE_ENV: "production", JWT_SECRET: undefined, CLIENT_URL: undefined, MONGODB_URI: undefined, PORT: "8080",
  });

  const rejects = (variable) => assert.throws(getServerConfig, (error) =>
    error instanceof ConfigurationError && error.message.includes(variable));

  rejects("JWT_SECRET");
  process.env.JWT_SECRET = "change-me";
  rejects("JWT_SECRET");
  process.env.JWT_SECRET = "production-test-secret-32-characters";
  rejects("CLIENT_URL");
  process.env.CLIENT_URL = "https://pizza.example.test/builder";
  rejects("CLIENT_URL");
  process.env.CLIENT_URL = "https://pizza.example.test/";
  rejects("MONGODB_URI");
  process.env.MONGODB_URI = "https://db.example.test";
  rejects("MONGODB_URI");
  process.env.MONGODB_URI = "mongodb+srv://db.example.test/pizza";

  assert.deepEqual(getServerConfig(), {
    port: 8080,
    clientOrigin: "https://pizza.example.test",
    mongoUri: "mongodb+srv://db.example.test/pizza",
  });
});
