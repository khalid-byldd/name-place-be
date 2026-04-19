import { db } from "../../db/client";
import { rooms, players } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

export interface CreateRoomInput {
  name: string;
  roundCount: number;
  roundTime: number;
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

export const roomService = {
  async createRoom(input: CreateRoomInput) {
    const code = generateRoomCode();

    const newRoom = await db
      .insert(rooms)
      .values({
        name: input.name,
        code,
        roundCount: input.roundCount,
        roundTime: input.roundTime,
        status: "WAITING",
      })
      .returning();

    return {
      id: newRoom[0].id,
      name: newRoom[0].name,
      code: newRoom[0].code,
      roundCount: newRoom[0].roundCount,
      roundTime: newRoom[0].roundTime,
      status: newRoom[0].status,
      createdAt: newRoom[0].createdAt,
    };
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

    return {
      id: room.id,
      name: room.name,
      code: room.code,
      roundCount: room.roundCount,
      roundTime: room.roundTime,
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
    if (input.roundCount !== undefined)
      updateData.roundCount = input.roundCount;
    if (input.roundTime !== undefined) updateData.roundTime = input.roundTime;
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await db
      .update(rooms)
      .set(updateData)
      .where(eq(rooms.id, roomId))
      .returning();

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

    // Delete all players in the room first (cascade will handle it)
    await db.delete(players).where(eq(players.roomId, roomId));

    // Then delete the room
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
          status: room.status,
          playerCount,
          createdAt: room.createdAt,
        };
      }),
    );

    return roomsWithPlayers;
  },
};
