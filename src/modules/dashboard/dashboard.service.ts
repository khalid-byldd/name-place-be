import { db } from "../../db/client";
import { rooms, players, bannedPlayers, roomStatusEnum } from "../../db/schema";
import { count, eq } from "drizzle-orm";

export const dashboardService = {
  async getStats() {
    const totalRoomsResult = await db.select({ value: count() }).from(rooms);
    const totalRooms = totalRoomsResult[0]?.value || 0;

    const totalPlayersResult = await db
      .select({ value: count() })
      .from(players);
    const totalPlayers = totalPlayersResult[0]?.value || 0;

    const activeRoomsResult = await db
      .select({ value: count() })
      .from(rooms)
      .where(eq(rooms.status, "IN_PROGRESS"));
    const activeRooms = activeRoomsResult[0]?.value || 0;

    const bannedPlayersResult = await db
      .select({ value: count() })
      .from(bannedPlayers);
    const totalBannedPlayers = bannedPlayersResult[0]?.value || 0;

    return {
      totalRoomsCreated: totalRooms,
      totalPlayersJoined: totalPlayers,
      activeRooms: activeRooms,
      totalBannedPlayers: totalBannedPlayers,
    };
  },
};
