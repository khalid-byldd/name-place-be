import { Server } from "http";
import { WebSocketServer } from "ws";
import { handleWSConnection } from "./helper";

export const initWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    handleWSConnection(socket);
  });

  return wss;
};
