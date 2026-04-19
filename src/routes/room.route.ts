import { Router, Request, Response, NextFunction } from "express";
import { roomService } from "../modules/room/room.service";
import { requireAdmin } from "../middleware";

const router = Router();

// Create a new room
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, roundCount, roundTime } = req.body;

    if (!name || roundCount === undefined || roundTime === undefined) {
      return res.status(400).json({
        message: "Name, roundCount, and roundTime are required",
      });
    }

    const room = await roomService.createRoom({
      name,
      roundCount,
      roundTime,
    });

    res.status(201).json({
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    next(error);
  }
});

// Get all rooms
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt((req.query.limit as string) || "50");
    const offset = parseInt((req.query.offset as string) || "0");

    const rooms = await roomService.getAllRooms(limit, offset);

    res.json({
      rooms,
      count: rooms.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get room details by ID
router.get(
  "/:roomId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId as string);

      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      const room = await roomService.getRoomById(roomId);
      res.json(room);
    } catch (error) {
      next(error);
    }
  },
);

// Get room by code (for joining)
router.get(
  "/code/:code",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.params;
      const room = await roomService.getRoomByCode(code as string);

      const roomDetails = await roomService.getRoomById(room.id);
      res.json(roomDetails);
    } catch (error) {
      next(error);
    }
  },
);

// Update room settings (admin only)
router.put(
  "/:roomId",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId as string);
      const { name, roundCount, roundTime, status } = req.body;

      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      const updatedRoom = await roomService.updateRoom(roomId, {
        name,
        roundCount,
        roundTime,
        status,
      });

      res.json({
        message: "Room updated successfully",
        room: updatedRoom,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Close/delete room (admin only)
router.delete(
  "/:roomId",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomId = parseInt(req.params.roomId as string);

      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }

      const result = await roomService.closeRoom(roomId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
