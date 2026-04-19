import { Router, Request, Response, NextFunction } from "express";
import { dashboardService } from "../modules/dashboard/dashboard.service";

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dashboardService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
