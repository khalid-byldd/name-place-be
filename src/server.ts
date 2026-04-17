import http from "http";
import { createApp } from "./app";
import { ENV } from "./config/env";
import { logger } from "./utils/logger";
import { initWebSocketServer } from "./websocket";

const app = createApp();
const server = http.createServer(app);

// Attach WebSocket server
initWebSocketServer(server);

server.listen(ENV.PORT, () => {
  logger.info(`Server running on port ${ENV.PORT}`);
});

// Graceful shutdown
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  logger.info("Shutting down server...");

  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}
