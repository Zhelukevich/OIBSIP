const developmentSecret = "development-secret";

export class ConfigurationError extends Error {}

export function getClientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret?.trim() || secret.trim() === developmentSecret)) {
    throw new ConfigurationError("Configure JWT_SECRET before starting in production");
  }
  return secret || developmentSecret;
}

export function getServerConfig() {
  getJwtSecret();
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError("PORT must be an integer between 1 and 65535");
  }
  const clientUrl = getClientUrl();
  if (!URL.canParse(clientUrl) || !["http:", "https:"].includes(new URL(clientUrl).protocol)) {
    throw new ConfigurationError("CLIENT_URL must be an HTTP or HTTPS URL");
  }
  return {
    port,
    clientOrigin: new URL(clientUrl).origin,
    mongoUri: process.env.MONGODB_URI ||
      "mongodb://127.0.0.1:27017/pizza-delivery?replicaSet=rs0&directConnection=true",
  };
}
