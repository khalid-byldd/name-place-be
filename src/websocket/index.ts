import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { handleWSConnection } from "./helper";
import { logger } from "../utils/logger";

interface HeartbeatSocket extends WebSocket {
  isAlive?: boolean;
}

export const initWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ server });

  // Ping every client every 25 seconds.
  // This serves two purposes:
  // 1. Keeps connections alive through Caddy's idle timeout
  // 2. Detects dead/half-open connections — if a client doesn't respond to a ping,
  //    it gets terminated so leaveRoom fires and stale sockets are evicted from rooms.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket: HeartbeatSocket) => {
      if (socket.isAlive === false) {
        logger.info("Terminating unresponsive WebSocket client");
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 25_000);

  wss.on("connection", (socket: HeartbeatSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    handleWSConnection(socket);
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
};
