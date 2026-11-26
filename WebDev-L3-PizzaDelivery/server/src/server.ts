import "dotenv/config";
import cors from "cors";
import express, { type Express } from "express";

const app: Express = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
