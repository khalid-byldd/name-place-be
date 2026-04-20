import { Router, Request, Response, NextFunction } from "express";
import { playerService } from "../modules/player/player.service";
import { roomService } from "../modules/room/room.service";
import { authenticate, requireAdmin } from "../middleware";

const router = Router();

// Create a new player
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Player name is required" });
    }

    const player = await playerService.createPlayer({ name });

    res.status(201).json({
      message: "Player created successfully",
      player,
    });
  } catch (error) {
    next(error);
  }
});

// Get player details
router.get(
  "/:playerId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = parseInt(req.params.playerId as string);

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await playerService.getPlayerById(playerId);
      res.json(player);
    } catch (error) {
      next(error);
    }
  },
);

// Update player name/status
router.put(
  "/:playerId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = parseInt(req.params.playerId as string);
      const { name, status } = req.body;

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const updated = await playerService.updatePlayer(playerId, {
        name,
        status,
      });

      res.json({
        message: "Player updated successfully",
        player: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Join room by code
router.post(
  "/:playerId/join-room",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = parseInt(req.params.playerId as string);
      const { code } = req.body;

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      if (!code) {
        return res.status(400).json({ message: "Room code is required" });
      }

      const room = await roomService.getRoomByCode(code);
      const joined = await playerService.joinRoom(playerId, room.id);

      res.json({
        message: "Joined room successfully",
        player: joined,
        room: {
          id: room.id,
          name: room.name,
          code: room.code,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Leave room
router.post(
  "/:playerId/leave-room",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = parseInt(req.params.playerId as string);

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await playerService.leaveRoom(playerId);

      res.json({
        message: "Left room successfully",
        player,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Delete player
router.delete(
  "/:playerId",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = parseInt(req.params.playerId as string);

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const result = await playerService.deletePlayer(playerId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// Ban player (admin only)
router.post(
  "/:playerId/ban",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = parseInt(req.params.playerId as string);
      const { reason } = req.body;

      if (isNaN(playerId)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const result = await playerService.banPlayer(playerId, reason);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// Get players in a room
router.get(
  "/room/:roomId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId as string);

      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      const roomPlayers = await playerService.getPlayersByRoom(roomId);

      res.json({
        roomId,
        players: roomPlayers,
        playerCount: roomPlayers.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
