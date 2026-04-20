import { db } from "../../db/client";
import { rounds, roundAnswers, players } from "../../db/schema";
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
};
