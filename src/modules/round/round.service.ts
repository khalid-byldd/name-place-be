import { sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  rounds,
  roundAnswers,
  players,
  rooms,
  categories,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../../utils/logger";

export interface SubmitAnswersInput {
  playerId: number;
  roundId: number;
  answers: string;
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
    const round = await db
      .select({
        id: rounds.id,
        roomId: rounds.roomId,
        roundNumber: rounds.roundNumber,
        letter: rounds.letter,
        categories: sql`json_agg(${categories})`.as("categories"),
        createdAt: rounds.createdAt,
      })
      .from(rounds)
      .where(eq(rounds.id, roundId))
      .leftJoin(
        categories,
        sql`${categories.id} = ANY(string_to_array(${rounds.categoryIds}, ',')::int[])`,
      )
      .groupBy(rounds.id);

    if (!round) {
      throw { status: 404, message: "Round not found" };
    }
    logger.info(`Round with categories: ${JSON.stringify(round)}`);
    return {
      id: round[0].id,
      roomId: round[0].roomId,
      roundNumber: round[0].roundNumber,
      letter: round[0].letter,
      createdAt: round[0].createdAt,
      categories: round[0].categories,
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

    // Check if player already submitted answers for this round
    const existingAnswers = await db.query.roundAnswers.findFirst({
      where: and(
        eq(roundAnswers.roundId, input.roundId),
        eq(roundAnswers.playerId, input.playerId),
      ),
    });

    if (existingAnswers) {
      throw {
        status: 400,
        message: `Player already submitted answers for round ${input.roundId}`,
      };
    }

    // Insert one answer per category
    const insertedAnswers = await db
      .insert(roundAnswers)
      .values({
        roundId: input.roundId,
        playerId: input.playerId,
        answer: input.answers.trim(),
        timeTaken: input.timeTaken,
        score: input.score,
      })
      .returning();

    return {
      roundId: input.roundId,
      playerId: input.playerId,
      answers: insertedAnswers[0].answer,
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
    const answersData = await db
      .select({
        id: roundAnswers.id,
        // categoryId: roundAnswers.categoryId,
        categoryName: categories.name,
        answer: roundAnswers.answer,
        playerId: roundAnswers.playerId,
        timeTaken: roundAnswers.timeTaken,
        score: roundAnswers.score,
        createdAt: roundAnswers.createdAt,
      })
      .from(roundAnswers)
      // .leftJoin(rounds, eq(rounds., categories.id))
      .where(eq(roundAnswers.roundId, roundId));

    return answersData.map((row) => ({
      id: row.id,
      // categoryId: row.categoryId,
      // category: row.categoryName
      //   ? { id: row.categoryId, name: row.categoryName }
      //   : null,
      answer: row.answer,
      playerId: row.playerId,
      timeTaken: row.timeTaken,
      score: row.score,
      createdAt: row.createdAt,
    }));
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

    const roundData = await db.query.rounds.findFirst({
      where: and(
        eq(rounds.roomId, roomId),
        eq(rounds.roundNumber, newCurrentRound),
      ),
    });

    return {
      roomId: updated[0].id,
      previousRound: room.currentRound,
      currentRound: updated[0].currentRound,
      roundCount: updated[0].roundCount,
      currentRoundId: roundData?.id,
      canIncrement: updated[0].currentRound < updated[0].roundCount,
      roundStartedAt: updated[0].roundStartedAt,
    };
  },

  async getRoundsByPlayerInRoom(roomId: number) {
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      throw { status: 404, message: "Room not found" };
    }

    const result = await db
      .select({
        roundId: rounds.id,
        playerId: players.id,
        playerName: players.name,
        letter: rounds.letter,

        // convert comma-separated answers into array
        answers: sql<string[]>`
        string_to_array(${roundAnswers.answer}, ',')
      `,

        score: roundAnswers.score,
        timeTaken: roundAnswers.timeTaken,
        roundCount: rooms.roundCount,
        roundAnswersId: roundAnswers.id,

        // categories as JSON array
        categories: sql<{ id: number; name: string }[]>`
        (
          SELECT json_agg(json_build_object('id', c.id, 'name', c.name))
          FROM ${categories} c
          WHERE c.id = ANY(
            string_to_array(${rounds.categoryIds}, ',')::int[]
          )
        )
      `,
      })
      .from(roundAnswers)
      .innerJoin(rounds, eq(roundAnswers.roundId, rounds.id))
      .innerJoin(players, eq(roundAnswers.playerId, players.id))
      .innerJoin(rooms, eq(rounds.roomId, rooms.id))
      .where(eq(rounds.roomId, roomId));

    return result;
  },
};
