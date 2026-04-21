import { Router, Request, Response, NextFunction } from "express";
import { roundService } from "../modules/round/round.service";

const router = Router();

// Get round details
router.get("/:roundId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roundId = parseInt(req.params.roundId);

    if (isNaN(roundId)) {
      return res.status(400).json({ message: "Invalid round ID" });
    }

    const round = await roundService.getRoundById(roundId);
    res.json(round);
  } catch (error) {
    next(error);
  }
});

// Submit answers for a round
router.post(
  "/:roundId/submit-answers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = parseInt(req.params.roundId);
      const { playerId, answers } = req.body;

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
      });

      res.json({
        message: "Answers submitted successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get round answers
router.get(
  "/:roundId/answers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = parseInt(req.params.roundId);

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
  }
);

// Get all rounds in a room
router.get(
  "/room/:roomId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId);

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
  }
);

// Get all rounds with answers for a specific player in a room
router.get(
  "/:roomId/player/:playerId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const playerId = parseInt(req.params.playerId);

      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const result = await roundService.getRoundsByPlayerInRoom(
        roomId,
        playerId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Update round metrics (score and timeTaken)
router.put(
  "/:roundId/update-metrics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roundId = parseInt(req.params.roundId);
      const { timeTaken, score } = req.body;

      if (isNaN(roundId)) {
        return res.status(400).json({ message: "Invalid round ID" });
      }

      const result = await roundService.updateRoundMetrics(
        roundId,
        timeTaken,
        score
      );

      res.json({
        message: "Round metrics updated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
