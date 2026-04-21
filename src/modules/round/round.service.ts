import { db } from "../../db/client";
import { rounds, roundAnswers, players } from "../../db/schema";
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
    // Verify room exists
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    // Verify player exists and is in the room
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    if (player.roomId !== roomId) {
      throw { status: 400, message: "Player is not in this room" };
    }

    // Get all rounds in room
    const allRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.roomId, roomId));

    // For each round, get the answers
    const roundsWithAnswers = await Promise.all(
      allRounds.map(async (round) => {
        const answers = await db.query.roundAnswers.findMany({
          where: eq(roundAnswers.roundId, round.id),
        });

        return {
          id: round.id,
          roomId: round.roomId,
          roundNumber: round.roundNumber,
          letter: round.letter,
          timeTaken: round.timeTaken,
          score: round.score,
          playerId: round.playerId,
          answers: answers.map((ans) => ({
            id: ans.id,
            categoryId: ans.categoryId,
            answer: ans.answer,
          })),
          createdAt: round.createdAt,
        };
      })
    );

    return {
      roomId,
      playerId,
      playerName: player.name,
      totalRounds: roundsWithAnswers.length,
      rounds: roundsWithAnswers,
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
