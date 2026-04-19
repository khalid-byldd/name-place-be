import { db } from "../../db/client";
import { players, bannedPlayers } from "../../db/schema";
import { eq, and } from "drizzle-orm";

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

    const updated = await db
      .update(players)
      .set({ roomId, updatedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning();

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

    const updated = await db
      .update(players)
      .set({ roomId: null, updatedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning();

    return {
      id: updated[0].id,
      name: updated[0].name,
      roomId: updated[0].roomId,
      status: updated[0].status,
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

  async banPlayer(playerId: number, reason?: string) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    await db
      .insert(bannedPlayers)
      .values({
        playerId,
        reason: reason || "No reason provided",
      })
      .returning();

    return { message: "Player banned successfully" };
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
