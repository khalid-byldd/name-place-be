import { Router } from "express";
import healthRoute from "./health.route";
import authRoute from "./auth.route";
import dashboardRoute from "./dashboard.route";
import { authenticate, requireAdmin } from "../middleware";

const router = Router();

router.use("/health", healthRoute);
router.use("/auth", authRoute);
router.use("/dashboard", authenticate, requireAdmin, dashboardRoute);

export default router;
