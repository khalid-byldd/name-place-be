import { Router } from "express";
import healthRoute from "./health.route";
import authRoute from "./auth.route";
import dashboardRoute from "./dashboard.route";
import roomRoute from "./room.route";
import playerRoute from "./player.route";
import roundRoute from "./round.route";
import categoryRoute from "./category.route";
import openaiRoute from "./openai.route";
import { authenticate, requireAdmin } from "../middleware";

const router = Router();

router.use("/health", healthRoute);
router.use("/auth", authRoute);
router.use("/dashboard", authenticate, requireAdmin, dashboardRoute);
router.use("/rooms", roomRoute);
router.use("/players", playerRoute);
router.use("/rounds", roundRoute);
router.use("/categories", authenticate, categoryRoute);
router.use("/ai", openaiRoute); // OpenAI API routes

export default router;
