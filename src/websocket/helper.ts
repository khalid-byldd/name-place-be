import { WebSocket } from "ws";
import { WSMessage } from "../types/ws";
import { logger } from "../utils/logger";
import { roomWsManager } from "../modules/room/room.ws";
import { playerService } from "../modules/player/player.service";
import { roomService } from "../modules/room/room.service";

interface ExtendedSocket extends WebSocket {
  roomId?: number;
  playerId?: number;
  playerName?: string;
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
                  playerName: socket.playerName,
                  message: message.payload.message,
                  timestamp: new Date(),
                },
              });
            }
          }
          break;

        case "PLAYER_UPDATE":
          {
            const playerId = socket.playerId;
            const { name, status } = message.payload;
            if (playerId) {
              try {
                await playerService.updatePlayer(playerId, { name, status });
                socket.send(
                  JSON.stringify({
                    type: "PLAYER_UPDATED",
                    payload: { playerId, name, status },
                  })
                );

                // Broadcast to room if player is in one
                if (socket.roomId) {
                  roomWsManager.broadcastToRoom(socket.roomId, {
                    type: "PLAYER_UPDATED",
                    payload: {
                      playerId,
                      name: name || socket.playerName,
                      timestamp: new Date(),
                    },
                  });
                }
              } catch (err) {
                socket.send(
                  JSON.stringify({
                    type: "ERROR",
                    payload: "Failed to update player",
                  })
                );
              }
            }
          }
          break;

        case "ROUND_OVER":
          {
            const roomId = socket.roomId;
            if (roomId) {
              try {
                const result = await roomService.incrementCurrentRound(roomId);

                roomWsManager.broadcastToRoom(roomId, {
                  type: "ROUND_COMPLETED",
                  payload: {
                    currentRound: result.currentRound,
                    roundCount: result.roundCount,
                    status: result.status,
                    isFinished: result.isFinished,
                    timestamp: new Date(),
                  },
                });

                // If all rounds are completed, close the room
                if (result.isFinished) {
                  setTimeout(() => {
                    roomWsManager.broadcastToRoom(roomId, {
                      type: "ROOM_FINISHED",
                      payload: {
                        roomId,
                        message: "All rounds completed. Room is now closed.",
                        timestamp: new Date(),
                      },
                    });
                  }, 1000);
                }
              } catch (err) {
                logger.error(`Error incrementing round: ${err}`);
                socket.send(
                  JSON.stringify({
                    type: "ERROR",
                    payload: "Failed to process round completion",
                  })
                );
              }
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
