import { db } from "../../db/client";
import { players, bannedPlayers, rooms } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { roomWsManager } from "../room/room.ws";

export interface CreatePlayerInput {
  name: string;
  roomId?: number;
}

export interface UpdatePlayerInput {
  name?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export const playerService = {
  async createPlayer(input: CreatePlayerInput) {
    const newPlayer = await db
      .insert(players)
      .values({
        name: input.name,
        roomId: input.roomId,
        status: "ACTIVE",
      })
      .returning();

    return {
      id: newPlayer[0].id,
      name: newPlayer[0].name,
      roomId: newPlayer[0].roomId,
      status: newPlayer[0].status,
      createdAt: newPlayer[0].createdAt,
    };
  },

  async getPlayerById(playerId: number) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    // Check if player is banned
    const banned = await db.query.bannedPlayers.findFirst({
      where: eq(bannedPlayers.playerId, playerId),
    });

    return {
      id: player.id,
      name: player.name,
      roomId: player.roomId,
      status: player.status,
      isBanned: !!banned,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    };
  },

  async updatePlayer(playerId: number, input: UpdatePlayerInput) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await db
      .update(players)
      .set(updateData)
      .where(eq(players.id, playerId))
      .returning();

    // Broadcast player update to room if player is in one
    if (updated[0].roomId) {
      roomWsManager.broadcastToRoom(updated[0].roomId, {
        type: "PLAYER_INFO_CHANGED",
        payload: {
          playerId: updated[0].id,
          name: updated[0].name,
          status: updated[0].status,
          changedVia: "api",
          timestamp: new Date(),
        },
      });
    }

    return {
      id: updated[0].id,
      name: updated[0].name,
      roomId: updated[0].roomId,
      status: updated[0].status,
      updatedAt: updated[0].updatedAt,
    };
  },

  async joinRoom(playerId: number, roomId: number) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    // Check if player is banned
    const banned = await db.query.bannedPlayers.findFirst({
      where: eq(bannedPlayers.playerId, playerId),
    });

    if (banned) {
      throw { status: 403, message: "Player is banned" };
    }

    // Check room exists and status is WAITING or IN_PROGRESS
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    if (room.status !== "WAITING" && room.status !== "IN_PROGRESS") {
      throw {
        status: 400,
        message: `Cannot join room with status ${room.status}. Room must be WAITING or IN_PROGRESS`,
      };
    }

    const wasAlreadyInRoom = player.roomId === roomId;

    const updated = await db
      .update(players)
      .set({ roomId, updatedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning();

    // Broadcast to WebSocket room that player joined or rejoined
    const eventType = wasAlreadyInRoom ? "PLAYER_REJOINED_ROOM" : "PLAYER_JOINED_ROOM";

    roomWsManager.broadcastToRoom(roomId, {
      type: eventType,
      payload: {
        playerId: updated[0].id,
        playerName: updated[0].name,
        joinedVia: "api",
        timestamp: new Date(),
      },
    });

    return {
      id: updated[0].id,
      name: updated[0].name,
      roomId: updated[0].roomId,
      status: updated[0].status,
    };
  },

  async leaveRoom(playerId: number) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    const roomId = player.roomId;

    if (!roomId) {
      throw { status: 400, message: "Player is not in any room" };
    }

    const updated = await db
      .update(players)
      .set({ roomId: null, updatedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning();

    // Broadcast to WebSocket room that player left via API
    roomWsManager.broadcastToRoom(roomId, {
      type: "PLAYER_LEFT_ROOM",
      payload: {
        playerId: updated[0].id,
        playerName: player.name,
        leftVia: "api",
        timestamp: new Date(),
      },
    });

    return {
      id: updated[0].id,
      name: updated[0].name,
      roomId: updated[0].roomId,
      status: updated[0].status,
      message: "Left room successfully",
    };
  },

  async deletePlayer(playerId: number) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    await db.delete(players).where(eq(players.id, playerId));

    return { message: "Player deleted successfully" };
  },

  /**
   * BAN PLAYER (Admin Only via API)
   * When a player is banned:
   * 1. Added to bannedPlayers table
   * 2. Disconnected from all WebSocket connections
   * 3. Broadcast PLAYER_BANNED event to their room
   * 4. Cannot join any room (checked in both HTTP API and WebSocket)
   */
  async banPlayer(playerId: number, reason?: string) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    // Add to banned players table
    await db
      .insert(bannedPlayers)
      .values({
        playerId,
        reason: reason || "No reason provided",
      })
      .returning();

    // Immediately disconnect player from WebSocket
    roomWsManager.disconnectPlayer(playerId, "Player has been banned");

    // Notify room if player is in one
    if (player.roomId) {
      roomWsManager.broadcastToRoom(player.roomId, {
        type: "PLAYER_BANNED",
        payload: {
          playerId: player.id,
          playerName: player.name,
          reason: reason || "No reason provided",
          timestamp: new Date(),
        },
      });
    }

    return {
      message: "Player banned successfully",
      playerId,
      reason: reason || "No reason provided",
    };
  },

  async getPlayersByRoom(roomId: number) {
    const roomPlayers = await db.query.players.findMany({
      where: eq(players.roomId, roomId),
    });

    return roomPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      roomId: p.roomId,
    }));
  },
};
