import { Router, Request, Response, NextFunction } from "express";
import { roundService } from "../modules/round/round.service";

const router = Router();

// Get round details
router.get(
  "/:roundId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = parseInt(req.params.roundId as string);

      if (isNaN(roundId)) {
        return res.status(400).json({ message: "Invalid round ID" });
      }

      const round = await roundService.getRoundById(roundId);
      res.json(round);
    } catch (error) {
      next(error);
    }
  },
);

// Submit answers for a round
router.post(
  "/:roundId/submit-answers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = parseInt(req.params.roundId as string);
      const { playerId, answers, score, timeTaken } = req.body;

      if (isNaN(roundId)) {
        return res.status(400).json({ message: "Invalid round ID" });
      }

      if (!playerId) {
        return res.status(400).json({ message: "Player ID is required" });
      }

      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({
          message: "Answers must be provided as an array",
        });
      }

      const result = await roundService.submitAnswers({
        playerId,
        roundId,
        answers,
        score,
        timeTaken,
      });

      res.json({
        message: "Answers submitted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get round answers
router.get(
  "/:roundId/answers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = parseInt(req.params.roundId as string);

      if (isNaN(roundId)) {
        return res.status(400).json({ message: "Invalid round ID" });
      }

      const answers = await roundService.getRoundAnswers(roundId);
      res.json({
        roundId,
        answers,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get all rounds in a room
router.get(
  "/room/:roomId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId as string);

      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      const roomRounds = await roundService.getRoundsByRoom(roomId);
      res.json({
        roomId,
        rounds: roomRounds,
        roundCount: roomRounds.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
