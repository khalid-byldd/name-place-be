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
        status: "ACTIVE",
      })
      .returning();

    return {
      id: newPlayer[0].id,
      name: newPlayer[0].name,
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

    return {
      id: updated[0].id,
      name: updated[0].name,
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

    const isThere = roomWsManager.getRoomPlayers(roomId).filter((players) => {
      players.playerId === playerId;
    })[0];

    if (isThere) {
      throw {
        status: 400,
        message: "Player is already in the room",
      };
    }

    roomWsManager.broadcastToRoom(roomId, {
      type: "PLAYER_JOINED_ROOM",
      payload: {
        playerId: player.id,
        playerName: player.name,
        joinedVia: "api",
        timestamp: new Date(),
      },
    });

    return {
      id: player.id,
      name: player.name,
      roomId,
      status: player.status,
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

    return {
      message: "Player banned successfully",
      playerId,
      reason: reason || "No reason provided",
    };
  },

  async getPlayersByRoom(roomId: number) {
    const roomPlayers = roomWsManager.getRoomPlayers(roomId);
    return roomPlayers.map((p) => ({
      id: p.playerId,
      name: p.playerName,
    }));
  },
};
