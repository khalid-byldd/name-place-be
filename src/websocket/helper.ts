import { WebSocket } from "ws";
import { WSMessage } from "../types/ws";
import { logger } from "../utils/logger";

export const handleWSConnection = (socket: WebSocket) => {
  logger.info("Client connected");

  socket.on("message", (data) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case "PING":
          socket.send(JSON.stringify({ type: "PONG" }));
          break;

        case "ECHO":
          socket.send(
            JSON.stringify({
              type: "ECHO",
              payload: message.payload,
            }),
          );
          break;

        default:
          socket.send(
            JSON.stringify({
              type: "ERROR",
              payload: "Unknown message type",
            }),
          );
      }
    } catch (err) {
      logger.error("Invalid WS message");
    }
  });

  socket.on("close", () => {
    logger.info("Client disconnected");
  });
};
