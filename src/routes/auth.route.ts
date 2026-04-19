import { Router, Request, Response, NextFunction } from "express";
import { authService } from "../modules/auth/auth.service";
import { authenticate } from "../middleware";

const router = Router();

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await authService.login(email, password);
    res.json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = authService.extractUserFromRequest(req);
    const userData = await authService.getUserById(user.id);
    res.json(userData);
  } catch (error) {
    next(error);
  }
});

export default router;
