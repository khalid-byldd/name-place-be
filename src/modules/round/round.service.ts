import { db } from "../../db/client";
import { rounds, roundAnswers, players, rooms, categories } from "../../db/schema";
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

    // Get all answers with category data using LEFT JOIN
    const answersData = await db
      .select({
        answerId: roundAnswers.id,
        categoryId: roundAnswers.categoryId,
        categoryName: categories.name,
        answer: roundAnswers.answer,
        playerId: roundAnswers.playerId,
        timeTaken: roundAnswers.timeTaken,
        score: roundAnswers.score,
      })
      .from(roundAnswers)
      .leftJoin(categories, eq(roundAnswers.categoryId, categories.id))
      .where(eq(roundAnswers.roundId, roundId));

    const answers = answersData.map((row) => ({
      id: row.answerId,
      categoryId: row.categoryId,
      category: row.categoryName ? { id: row.categoryId, name: row.categoryName } : null,
      answer: row.answer,
      playerId: row.playerId,
      timeTaken: row.timeTaken,
      score: row.score,
    }));

    return {
      id: round.id,
      roomId: round.roomId,
      roundNumber: round.roundNumber,
      letter: round.letter,
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

    // Parse category IDs from round
    const categoryIds = round.categoryIds
      .split(",")
      .map((id) => parseInt(id.trim()));

    if (categoryIds.length !== input.answers.length) {
      throw {
        status: 400,
        message: `Expected ${categoryIds.length} answers, got ${input.answers.length}`,
      };
    }

    // Check if player already submitted answers for this round
    const existingAnswers = await db.query.roundAnswers.findFirst({
      where: and(
        eq(roundAnswers.roundId, input.roundId),
        eq(roundAnswers.playerId, input.playerId)
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
      .values(
        input.answers.map((answer, index) => ({
          roundId: input.roundId,
          categoryId: categoryIds[index],
          playerId: input.playerId,
          answer: answer.trim(),
          timeTaken: input.timeTaken,
          score: input.score,
        }))
      )
      .returning();

    return {
      roundId: input.roundId,
      playerId: input.playerId,
      answersCount: insertedAnswers.length,
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
        categoryId: roundAnswers.categoryId,
        categoryName: categories.name,
        answer: roundAnswers.answer,
        playerId: roundAnswers.playerId,
        timeTaken: roundAnswers.timeTaken,
        score: roundAnswers.score,
        createdAt: roundAnswers.createdAt,
      })
      .from(roundAnswers)
      .leftJoin(categories, eq(roundAnswers.categoryId, categories.id))
      .where(eq(roundAnswers.roundId, roundId));

    return answersData.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      category: row.categoryName ? { id: row.categoryId, name: row.categoryName } : null,
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

    return {
      roomId: updated[0].id,
      previousRound: room.currentRound,
      currentRound: updated[0].currentRound,
      roundCount: updated[0].roundCount,
      canIncrement: updated[0].currentRound < updated[0].roundCount,
    };
  },

  async getRoundsByPlayerInRoom(roomId: number, playerId: number) {
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      throw { status: 404, message: "Player not found" };
    }

    // Get all rounds with answers using LEFT JOIN
    const roundsData = await db
      .select({
        roundId: rounds.id,
        roomId: rounds.roomId,
        roundNumber: rounds.roundNumber,
        letter: rounds.letter,
        roundCreatedAt: rounds.createdAt,
        answerId: roundAnswers.id,
        answerCategoryId: roundAnswers.categoryId,
        categoryName: categories.name,
        answer: roundAnswers.answer,
        answerPlayerId: roundAnswers.playerId,
        timeTaken: roundAnswers.timeTaken,
        score: roundAnswers.score,
      })
      .from(rounds)
      .leftJoin(roundAnswers, eq(roundAnswers.roundId, rounds.id))
      .leftJoin(categories, eq(roundAnswers.categoryId, categories.id))
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
          createdAt: row.roundCreatedAt,
          answers: [],
        });
      }

      if (row.answerId) {
        roundsMap.get(row.roundId).answers.push({
          id: row.answerId,
          categoryId: row.answerCategoryId,
          category: row.categoryName ? { id: row.answerCategoryId, name: row.categoryName } : null,
          answer: row.answer,
          playerId: row.answerPlayerId,
          timeTaken: row.timeTaken,
          score: row.score,
        });
      }
    });

    return {
      roomId,
      playerId,
      playerName: player.name,
      totalRounds: roundsMap.size,
      rounds: Array.from(roundsMap.values()),
    };
  },
};
