import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ENV } from "../config/env";
import * as schema from "./schema";
const pool = new Pool({
  connectionString: ENV.DB_URL,
});

export const db = drizzle(pool, { schema });
