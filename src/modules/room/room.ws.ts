import { WebSocket } from "ws";
import { db } from "../../db/client";
import { players, rooms } from "../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { roomService } from "./room.service";

interface RoomWSClient {
  socket: any;
  roomId: number;
  playerId: number;
  playerName: string;
}

const activeConnections = new Map<number, Set<RoomWSClient>>();
const roomMetadata = new Map<number, { name: string; createdAt: Date }>();
// Grace period before auto-closing an empty room — prevents brief network drops
// (common through reverse proxies like Caddy) from permanently destroying the room
const pendingCloseTimers = new Map<number, ReturnType<typeof setTimeout>>();

export const roomWsManager = {
  initializeRoom(roomId: number, roomName: string) {
    roomMetadata.set(roomId, {
      name: roomName,
      createdAt: new Date(),
    });
    logger.info(`Room ${roomId} initialized for WebSocket connections`);
  },

  async joinRoom(
    socket: any,
    roomId: number,
    playerId: number,
    playerName: string,
  ) {
    // Cancel any pending auto-close for this room (player reconnected in time)
    const pendingTimer = pendingCloseTimers.get(roomId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingCloseTimers.delete(roomId);
      logger.info(`Cancelled pending close for room ${roomId} — player reconnected`);
    }

    if (!activeConnections.has(roomId)) {
      activeConnections.set(roomId, new Set());
    }

    // Store metadata on socket for later use
    socket.playerName = playerName;

    const roomClients = activeConnections.get(roomId)!;

    // If player already exists (e.g. reconnect after network drop), replace old socket
    const existingClient = [...roomClients].find((c) => c.playerId === playerId);
    if (existingClient) {
      logger.info(`Player ${playerId} reconnected to room ${roomId}, replacing old socket`);
      roomClients.delete(existingClient);
    }

    const client: RoomWSClient = { socket, roomId, playerId, playerName };
    activeConnections.get(roomId)!.add(client);

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (room) {
      this.broadcastToRoom(roomId, {
        type: "PLAYER_JOINED_ROOM",
        payload: {
          playerId,
          playerName,
          roomId,
          timestamp: new Date(),
        },
      });

      socket.send(
        JSON.stringify({
          type: "JOIN_SUCCESS",
          payload: {
            roomId,
            roomName: room.name,
            roomStatus: room.status,
            roundCount: room.roundCount,
            roundTime: room.roundTime,
          },
        }),
      );
    }

    return client;
  },

  leaveRoom(socket: WebSocket, roomId: number) {
    const clients = activeConnections.get(roomId);
    if (!clients) return;

    let leftPlayer: RoomWSClient | null = null;
    for (const client of clients) {
      if (client.socket === socket) {
        leftPlayer = client;
        clients.delete(client);
        break;
      }
    }

    if (leftPlayer) {
      this.broadcastToRoom(roomId, {
        type: "PLAYER_LEFT_ROOM",
        payload: {
          playerId: leftPlayer.playerId,
          playerName: leftPlayer.playerName,
          timestamp: new Date(),
        },
      });
    }

    if (clients.size === 0) {
      // Wait 30 seconds before closing — gives players time to reconnect after
      // brief network drops (especially common behind reverse proxies like Caddy).
      // If any player rejoins within this window, joinRoom() cancels this timer.
      const timer = setTimeout(() => {
        pendingCloseTimers.delete(roomId);
        if ((activeConnections.get(roomId)?.size ?? 0) === 0) {
          activeConnections.delete(roomId);
          roomService.closeRoom(roomId).catch(() => {});
          logger.info(`Room ${roomId} auto-closed after grace period (no reconnects)`);
        }
      }, 30_000);
      pendingCloseTimers.set(roomId, timer);
      logger.info(`Room ${roomId} is empty — starting 30s grace period before auto-close`);
    }
  },

  getRoomPlayers(roomId: number) {
    const clients = activeConnections.get(roomId) || new Set();
    logger.info(
      `Getting players for room ${roomId}: ${JSON.stringify(clients)} connected`,
    );
    return Array.from(clients).map((c) => ({
      playerId: c.playerId,
      playerName: c.playerName,
    }));
  },

  broadcastToRoom(roomId: number, message: any) {
    const clients = activeConnections.get(roomId);
    if (!clients) return;

    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.socket.readyState === 1) {
        client.socket.send(data);
      }
    });
  },

  updateRoomStatus(roomId: number, status: string) {
    this.broadcastToRoom(roomId, {
      type: "ROOM_STATUS_CHANGED",
      payload: { status, timestamp: new Date() },
    });
  },

  async getRoomConnectedPlayers(roomId: number) {
    const clients = activeConnections.get(roomId) || new Set();
    return {
      roomId,
      connectedPlayers: this.getRoomPlayers(roomId),
      playerCount: clients.size,
    };
  },

  closeRoom(roomId: number) {
    const pending = pendingCloseTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      pendingCloseTimers.delete(roomId);
    }

    const clients = activeConnections.get(roomId);

    clients?.forEach((client) => {
      if (client.socket.readyState === 1) {
        client.socket.close(1000, "Room closed");
      }
    });

    activeConnections.delete(roomId);
    roomMetadata.delete(roomId);
    logger.info(`Room ${roomId} closed and all connections terminated`);
  },

  getRoomMetadata(roomId: number) {
    return roomMetadata.get(roomId);
  },

  disconnectPlayer(playerId: number, reason?: string) {
    let disconnected = false;
    activeConnections.forEach((clients) => {
      clients.forEach((client) => {
        if (client.playerId === playerId) {
          if (client.socket.readyState === 1) {
            client.socket.close(1000, reason || "Disconnected");
          }
          clients.delete(client);
          disconnected = true;
        }
      });
    });
    return disconnected;
  },
};
