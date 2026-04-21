import { db } from "../../db/client";
import { rounds, roundAnswers, players, rooms } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export interface SubmitAnswersInput {
  playerId: number;
  roundId: number;
  answers: string[];
  timeTaken: number; // Time taken in seconds
  score: number; // Score for the submitted answers
}

export interface CreateRoundInput {
  roomId: number;
  roundNumber: number;
  categoryIds: number[];
}

export const roundService = {
  async createRoundsForRoom(
    roomId: number,
    roundCount: number,
    categoryIds: number[],
  ) {
    const createdRounds = [];

    for (let i = 1; i <= roundCount; i++) {
      const newRound = await db
        .insert(rounds)
        .values({
          roomId,
          roundNumber: i,
          letter: this.getRandomLetter(),
          categoryIds: categoryIds.join(","), // Store category IDs as a comma-separated string
        })
        .returning();

      createdRounds.push(newRound[0]);
    }

    return createdRounds;
  },

  async getRoundById(roundId: number) {
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, roundId),
    });

    if (!round) {
      throw { status: 404, message: "Round not found" };
    }

    return {
      id: round.id,
      roomId: round.roomId,
      roundNumber: round.roundNumber,
      letter: round.letter,
      categoryIds: round.categoryIds,
      createdAt: round.createdAt,
    };
  },

  async submitAnswers(input: SubmitAnswersInput) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, input.playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, input.roundId),
    });

    if (!round) {
      throw { status: 404, message: "Round not found" };
    }

    // Get all round answers for this round
    const existingAnswers = await db.query.roundAnswers.findFirst({
      where: eq(roundAnswers.roundId, input.roundId),
    });

    if (existingAnswers) {
      throw {
        status: 400,
        message: `Already submitted answers for round ${input.roundId} by player ${input.playerId}`,
      };
    }

    // Update each round answer with the player's answer
    const answersWithComma = input.answers
      .map((answer) => answer.trim())
      .join(",");

    const newAnswer = await db
      .insert(roundAnswers)
      .values({
        roundId: input.roundId,
        playerId: input.playerId,
        answers: answersWithComma,
        timeTaken: input.timeTaken,
        score: input.score,
      })
      .returning();

    return {
      roundId: input.roundId,
      playerId: input.playerId,
    };
  },

  async getRoundsByRoom(roomId: number) {
    const roomRounds = await db.query.rounds.findMany({
      where: eq(rounds.roomId, roomId),
    });

    return roomRounds.map((round) => ({
      id: round.id,
      roomId: round.roomId,
      roundNumber: round.roundNumber,
      letter: round.letter,
    }));
  },

  async getRoundAnswers(roundId: number) {
    const answers = await db.query.roundAnswers.findMany({
      where: eq(roundAnswers.roundId, roundId),
    });

    return answers;
  },

  getRandomLetter(): string {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return letters.charAt(Math.floor(Math.random() * letters.length));
  },

  async incrementRoomRound(roomId: number) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    // Check if we can increment (currentRound < roundCount)
    if (room.currentRound >= room.roundCount) {
      throw {
        status: 400,
        message: `Cannot increment. Current round (${room.currentRound}) has reached max (${room.roundCount})`,
      };
    }

    const newCurrentRound = room.currentRound + 1;

    const updated = await db
      .update(rooms)
      .set({
        currentRound: newCurrentRound,
        roundStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, roomId))
      .returning();

    return {
      roomId: updated[0].id,
      previousRound: room.currentRound,
      currentRound: updated[0].currentRound,
      roundCount: updated[0].roundCount,
      canIncrement: updated[0].currentRound < updated[0].roundCount,
    };
  },

  async getRoundsByPlayerInRoom(roomId: number, playerId: number) {
    // Verify room exists and player is in room (single query with join)
    const playerInRoom = await db
      .select({
        playerId: players.id,
        playerName: players.name,
        playerRoomId: players.roomId,
      })
      .from(players)
      .innerJoin(rooms, eq(rooms.id, players.roomId))
      .where(and(eq(players.id, playerId), eq(rooms.id, roomId)))
      .limit(1);

    if (playerInRoom.length === 0) {
      throw { status: 404, message: "Player not found or not in this room" };
    }

    const player = playerInRoom[0];

    // Get all rounds with answers using LEFT JOIN (single query)
    const roundsData = await db
      .select({
        roundId: rounds.id,
        roomId: rounds.roomId,
        roundNumber: rounds.roundNumber,
        letter: rounds.letter,
        timeTaken: roundAnswers.timeTaken,
        score: roundAnswers.score,
        playerId: roundAnswers.playerId,
        createdAt: rounds.createdAt,
        answerId: roundAnswers.id,
        categoryId: rounds.categoryIds,
        answer: roundAnswers.answers,
      })
      .from(rounds)
      .leftJoin(roundAnswers, eq(roundAnswers.roundId, rounds.id))
      .where(eq(rounds.roomId, roomId))
      .orderBy(rounds.id);

    // Transform flat result into nested structure
    const roundsMap = new Map();
    roundsData.forEach((row) => {
      if (!roundsMap.has(row.roundId)) {
        roundsMap.set(row.roundId, {
          id: row.roundId,
          roomId: row.roomId,
          roundNumber: row.roundNumber,
          letter: row.letter,
          timeTaken: row.timeTaken,
          score: row.score,
          playerId: row.playerId,
          createdAt: row.createdAt,
          answers: [],
        });
      }

      if (row.answerId) {
        roundsMap.get(row.roundId).answers.push({
          id: row.answerId,
          categoryId: row.categoryId,
          answer: row.answer,
        });
      }
    });

    return {
      roomId,
      playerId,
      playerName: player.playerName,
      totalRounds: roundsMap.size,
      rounds: Array.from(roundsMap.values()),
    };
  },
};
