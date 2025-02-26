import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: ".src/schema/schema.ts",
  out: ".src/schema/migration",
  dialect: "mysql",
  dbCredentials: {
    host: "localhost",
    user: "user",
    password: "password",
    database: "db",
  },
  verbose: true,
  strict: true,
});
