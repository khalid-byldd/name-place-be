import express from "express";
import helmet from "helmet";
import cors from "cors";

import routes from "./routes/index.route";
import { notFound } from "./middleware";
import { errorHandler } from "./utils/errorHandler";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use("/api/v1", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
