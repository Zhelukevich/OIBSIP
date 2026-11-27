const developmentSecret = "development-secret";
const developmentClientUrl = "http://localhost:5173";
const developmentMongoUri = "mongodb://127.0.0.1:27017/pizza-delivery?replicaSet=rs0&directConnection=true";

export class ConfigurationError extends Error {}

export function getClientUrl() {
  return process.env.CLIENT_URL?.trim() || developmentClientUrl;
}

export function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase();
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret?.trim() || secret.trim() === developmentSecret)) {
    throw new ConfigurationError("Configure JWT_SECRET before starting in production");
  }
  return secret || developmentSecret;
}

export function getServerConfig() {
  const production = process.env.NODE_ENV === "production";
  const jwtSecret = getJwtSecret();
  if (production && jwtSecret.trim().length < 32) {
    throw new ConfigurationError("JWT_SECRET must be at least 32 characters in production");
  }

  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError("PORT must be an integer between 1 and 65535");
  }
  if (production && !process.env.CLIENT_URL?.trim()) {
    throw new ConfigurationError("Configure CLIENT_URL before starting in production");
  }
  const clientUrlValue = getClientUrl();
  const clientUrl = URL.canParse(clientUrlValue) ? new URL(clientUrlValue) : null;
  if (!clientUrl || !["http:", "https:"].includes(clientUrl.protocol) ||
    clientUrl.username || clientUrl.password || clientUrl.pathname !== "/" || clientUrl.search || clientUrl.hash) {
    throw new ConfigurationError("CLIENT_URL must be an HTTP or HTTPS origin without a path, query, or fragment");
  }

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (production && !mongoUri) {
    throw new ConfigurationError("Configure MONGODB_URI before starting in production");
  }
  if (mongoUri && !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
    throw new ConfigurationError("MONGODB_URI must be a MongoDB connection string starting with mongodb:// or mongodb+srv://");
  }

  return {
    port,
    clientOrigin: clientUrl.origin,
    mongoUri: mongoUri || developmentMongoUri,
  };
}
