import { db } from "../../db/client";
import { rounds, roundAnswers, players, rooms } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export interface SubmitAnswersInput {
  playerId: number;
  roundId: number;
  answers: string[];
}

export interface CreateRoundInput {
  roomId: number;
  roundNumber: number;
  categoryIds: number[];
}

export const roundService = {
  async createRoundsForRoom(roomId: number, roundCount: number, categoryIds: number[]) {
    const createdRounds = [];

    for (let i = 1; i <= roundCount; i++) {
      const newRound = await db
        .insert(rounds)
        .values({
          roomId,
          roundNumber: i,
          letter: this.getRandomLetter(),
        })
        .returning();

      createdRounds.push(newRound[0]);

      // Create round answers for each category
      for (const categoryId of categoryIds) {
        await db
          .insert(roundAnswers)
          .values({
            roundId: newRound[0].id,
            categoryId,
            answer: null,
          })
          .returning();
      }
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

    const answers = await db.query.roundAnswers.findMany({
      where: eq(roundAnswers.roundId, roundId),
    });

    return {
      id: round.id,
      roomId: round.roomId,
      playerId: round.playerId,
      roundNumber: round.roundNumber,
      letter: round.letter,
      timeTaken: round.timeTaken,
      score: round.score,
      answers,
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
    const existingAnswers = await db.query.roundAnswers.findMany({
      where: eq(roundAnswers.roundId, input.roundId),
    });

    if (existingAnswers.length !== input.answers.length) {
      throw {
        status: 400,
        message: `Expected ${existingAnswers.length} answers, got ${input.answers.length}`,
      };
    }

    // Update each round answer with the player's answer
    const answersWithComma = input.answers.map((answer) => answer.trim()).join(",");

    const updatedAnswers = [];
    for (let i = 0; i < existingAnswers.length; i++) {
      const updated = await db
        .update(roundAnswers)
        .set({
          answer: input.answers[i] ? input.answers[i].trim() : null,
        })
        .where(eq(roundAnswers.id, existingAnswers[i].id))
        .returning();

      updatedAnswers.push(updated[0]);
    }

    // Update round with player info if not already set
    if (!round.playerId) {
      await db
        .update(rounds)
        .set({ playerId: input.playerId })
        .where(eq(rounds.id, input.roundId))
        .returning();
    }

    return {
      roundId: input.roundId,
      playerId: input.playerId,
      answers: updatedAnswers,
      submittedAt: new Date(),
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
        timeTaken: rounds.timeTaken,
        score: rounds.score,
        playerId: rounds.playerId,
        createdAt: rounds.createdAt,
        answerId: roundAnswers.id,
        categoryId: roundAnswers.categoryId,
        answer: roundAnswers.answer,
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

  async updateRoundMetrics(
    roundId: number,
    timeTaken?: number,
    score?: number
  ) {
    const round = await db.query.rounds.findFirst({
      where: eq(rounds.id, roundId),
    });

    if (!round) {
      throw { status: 404, message: "Round not found" };
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (timeTaken !== undefined) {
      if (timeTaken < 0) {
        throw { status: 400, message: "Time taken cannot be negative" };
      }
      updateData.timeTaken = timeTaken;
    }

    if (score !== undefined) {
      if (score < 0) {
        throw { status: 400, message: "Score cannot be negative" };
      }
      updateData.score = score;
    }

    const updated = await db
      .update(rounds)
      .set(updateData)
      .where(eq(rounds.id, roundId))
      .returning();

    return {
      id: updated[0].id,
      roundId: updated[0].id,
      playerId: updated[0].playerId,
      timeTaken: updated[0].timeTaken,
      score: updated[0].score,
      updatedAt: updated[0].updatedAt,
    };
  },
};
