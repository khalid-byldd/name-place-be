import { ENV } from "./src/config/env";

export default {
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DB_URL,
  },
};
