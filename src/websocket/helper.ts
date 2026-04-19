import { WebSocket } from "ws";
import { WSMessage } from "../types/ws";
import { logger } from "../utils/logger";
import { roomWsManager } from "../modules/room/room.ws";

interface ExtendedSocket extends WebSocket {
  roomId?: number;
  playerId?: number;
}

export const handleWSConnection = (socket: ExtendedSocket) => {
  logger.info("Client connected");

  socket.on("message", async (data) => {
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

        // Room WS events
        case "ROOM_JOIN":
          {
            const { roomId, playerId, playerName } = message.payload;
            socket.roomId = roomId;
            socket.playerId = playerId;
            await roomWsManager.joinRoom(socket, roomId, playerId, playerName);
          }
          break;

        case "ROOM_LEAVE":
          {
            const roomId = socket.roomId;
            if (roomId) {
              roomWsManager.leaveRoom(socket, roomId);
            }
          }
          break;

        case "GET_ROOM_PLAYERS":
          {
            const roomId = socket.roomId;
            if (roomId) {
              const players = roomWsManager.getRoomPlayers(roomId);
              socket.send(
                JSON.stringify({
                  type: "ROOM_PLAYERS",
                  payload: { roomId, players },
                })
              );
            }
          }
          break;

        case "ROOM_MESSAGE":
          {
            const roomId = socket.roomId;
            if (roomId) {
              roomWsManager.broadcastToRoom(roomId, {
                type: "ROOM_MESSAGE",
                payload: {
                  playerId: socket.playerId,
                  playerName: message.payload.playerName,
                  message: message.payload.message,
                  timestamp: new Date(),
                },
              });
            }
          }
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
    if (socket.roomId) {
      roomWsManager.leaveRoom(socket, socket.roomId);
    }
    logger.info("Client disconnected");
  });
};
