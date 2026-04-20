import { db } from "../../db/client";
import { rooms, players, categories } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { roomWsManager } from "./room.ws";
import { roundService } from "../round/round.service";

export interface CreateRoomInput {
  name: string;
  roundCount: number;
  roundTime: number;
  categoryIds?: number[];
}

export interface UpdateRoomInput {
  name?: string;
  roundCount?: number;
  roundTime?: number;
  status?: "WAITING" | "IN_PROGRESS" | "FINISHED";
}

const generateRoomCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const generateRandomLetter = (): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
};

const selectRandomCategories = (allCategories: any[], count: number = 4): string => {
  if (allCategories.length === 0) {
    return "";
  }

  const selected: number[] = [];
  const shuffled = [...allCategories].sort(() => 0.5 - Math.random());

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    selected.push(shuffled[i].id);
  }

  return selected.join(",");
};

export const roomService = {
  async createRoom(input: CreateRoomInput) {
    const code = generateRoomCode();

    // Get category IDs - either from input or select 4 random
    let categoryIds = input.categoryIds;
    if (!categoryIds || categoryIds.length === 0) {
      const allCategories = await db.query.categories.findMany();
      if (allCategories.length < 4) {
        throw { status: 400, message: "Need at least 4 categories available" };
      }
      // Select 4 random categories
      categoryIds = [];
      const shuffled = [...allCategories].sort(() => 0.5 - Math.random());
      for (let i = 0; i < 4; i++) {
        categoryIds.push(shuffled[i].id);
      }
    }

    if (categoryIds.length !== 4) {
      throw { status: 400, message: "Must provide exactly 4 category IDs" };
    }

    // Store categoryIds as comma-separated string
    const categoryIdsString = categoryIds.join(",");

    const newRoom = await db
      .insert(rooms)
      .values({
        name: input.name,
        code,
        roundCount: input.roundCount,
        roundTime: input.roundTime,
        categoryIds: categoryIdsString,
        status: "WAITING",
      })
      .returning();

    // Create all rounds for the room
    await roundService.createRoundsForRoom(newRoom[0].id, input.roundCount, categoryIds);

    const roomData = {
      id: newRoom[0].id,
      name: newRoom[0].name,
      code: newRoom[0].code,
      roundCount: newRoom[0].roundCount,
      roundTime: newRoom[0].roundTime,
      categoryIds: categoryIds,
      status: newRoom[0].status,
      createdAt: newRoom[0].createdAt,
    };

    // Notify WebSocket that room is ready for connections
    roomWsManager.initializeRoom(newRoom[0].id, newRoom[0].name);

    return roomData;
  },

  async getRoomById(roomId: number) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    const playersInRoom = await db.query.players.findMany({
      where: eq(players.roomId, roomId),
    });

    const categoryIds = room.categoryIds.split(",").map((id) => parseInt(id));

    return {
      id: room.id,
      name: room.name,
      code: room.code,
      roundCount: room.roundCount,
      roundTime: room.roundTime,
      currentRound: room.currentRound,
      categoryIds: categoryIds,
      status: room.status,
      playerCount: playersInRoom.length,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  },

  async getRoomByCode(code: string) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.code, code),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    return room;
  },

  async updateRoom(roomId: number, input: UpdateRoomInput) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.roundCount !== undefined) updateData.roundCount = input.roundCount;
    if (input.roundTime !== undefined) updateData.roundTime = input.roundTime;
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await db
      .update(rooms)
      .set(updateData)
      .where(eq(rooms.id, roomId))
      .returning();

    // Broadcast room update to all connected WebSocket clients
    if (input.status !== undefined) {
      roomWsManager.updateRoomStatus(roomId, input.status);
    }

    if (input.name !== undefined || input.roundCount !== undefined || input.roundTime !== undefined) {
      roomWsManager.broadcastToRoom(roomId, {
        type: "ROOM_SETTINGS_CHANGED",
        payload: {
          name: input.name,
          roundCount: input.roundCount,
          roundTime: input.roundTime,
          timestamp: new Date(),
        },
      });
    }

    return {
      id: updated[0].id,
      name: updated[0].name,
      code: updated[0].code,
      roundCount: updated[0].roundCount,
      roundTime: updated[0].roundTime,
      status: updated[0].status,
      updatedAt: updated[0].updatedAt,
    };
  },

  async closeRoom(roomId: number) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    // Notify all connected WebSocket clients before closing
    roomWsManager.broadcastToRoom(roomId, {
      type: "ROOM_CLOSED",
      payload: {
        roomId,
        message: "Room has been closed by admin",
        timestamp: new Date(),
      },
    });

    // Disconnect all WebSocket clients in the room
    roomWsManager.closeRoom(roomId);

    // Delete all players in the room
    await db.delete(players).where(eq(players.roomId, roomId));

    // Delete the room
    await db.delete(rooms).where(eq(rooms.id, roomId));

    return { message: "Room closed successfully" };
  },

  async getAllRooms(limit = 50, offset = 0) {
    const allRooms = await db.query.rooms.findMany({
      limit,
      offset,
      orderBy: desc(rooms.createdAt),
    });

    const roomsWithPlayers = await Promise.all(
      allRooms.map(async (room) => {
        const playerCount = await db.query.players
          .findMany({
            where: eq(players.roomId, room.id),
          })
          .then((p) => p.length);

        return {
          id: room.id,
          name: room.name,
          code: room.code,
          roundCount: room.roundCount,
          roundTime: room.roundTime,
          currentRound: room.currentRound,
          status: room.status,
          playerCount,
          createdAt: room.createdAt,
        };
      })
    );

    return roomsWithPlayers;
  },

  async getRoundsByRoom(roomId: number) {
    const roomRounds = await db.query.rounds.findMany({
      where: eq(rounds.roomId, roomId),
    });

    return roomRounds.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      roundNumber: r.roundNumber,
      letter: r.letter,
      categoryIds: r.categoryIds.split(",").map((id) => parseInt(id)),
      timeTaken: r.timeTaken,
      score: r.score,
      playerId: r.playerId,
      createdAt: r.createdAt,
    }));
  },

  async incrementCurrentRound(roomId: number) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    const newCurrentRound = room.currentRound + 1;
    const isLastRound = newCurrentRound >= room.roundCount;

    const updatedRoom = await db
      .update(rooms)
      .set({
        currentRound: newCurrentRound,
        status: isLastRound ? "FINISHED" : room.status,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, roomId))
      .returning();

    return {
      roomId: updatedRoom[0].id,
      currentRound: updatedRoom[0].currentRound,
      roundCount: updatedRoom[0].roundCount,
      status: updatedRoom[0].status,
      isFinished: isLastRound,
    };
  },
};
