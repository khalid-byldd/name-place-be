import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ENV } from "../config/env";

const pool = new Pool({
  connectionString: ENV.DB_URL,
});

export const db = drizzle(pool);
