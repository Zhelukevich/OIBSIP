import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const args = process.argv.slice(2);
const production = args.includes("--production") ||
  (!args.includes("--development") && process.env.NODE_ENV === "production");
const mode = production ? "production" : "development";
const path = fileURLToPath(new URL(`../.env.${mode}`, import.meta.url));

const { error } = config({ path });
if (error && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

process.env.NODE_ENV = mode;
