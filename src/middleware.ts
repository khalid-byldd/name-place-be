import { Request, Response, NextFunction } from "express";
import { db } from "./db/client";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    // Decode token - token format: base64(userId:email)
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId] = decoded.split(":");

    const user = await db.query.users.findFirst({
      where: eq(users.id, parseInt(userId)),
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};
