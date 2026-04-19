import { Request } from "express";
import { db } from "../../db/client";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export interface UserPayload {
  id: number;
  email: string;
  role: string;
}

export const authService = {
  async login(email: string, password: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      throw { status: 401, message: "Invalid credentials" };
    }

    // Check if user has admin role
    if (user.role !== "ADMIN") {
      throw { status: 403, message: "Only admins can login" };
    }

    // In production, compare hashed passwords
    if (user.password !== password) {
      throw { status: 401, message: "Invalid credentials" };
    }

    // Generate token: base64(userId:email)
    const token = Buffer.from(`${user.id}:${user.email}`).toString("base64");

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      token,
    };
  },

  async getUserById(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  },

  extractUserFromRequest(req: Request): UserPayload {
    const user = (req as any).user as UserPayload;
    if (!user) {
      throw { status: 401, message: "Unauthorized" };
    }
    return user;
  },
};
