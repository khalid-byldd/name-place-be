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
};
