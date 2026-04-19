import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

/* ================= ENUMS ================= */

export const roomStatusEnum = pgEnum("room_status", [
  "WAITING",
  "IN_PROGRESS",
  "FINISHED",
]);

export const playerStatusEnum = pgEnum("player_status", ["ACTIVE", "INACTIVE"]);
export const userRoleEnum = pgEnum("user_role", ["ADMIN", "USER"]);

/* ================= USERS ================= */

export const users = pgTable("users", {
  id: integer("id").primaryKey(),

  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").default("USER").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ================= ROOMS ================= */

export const rooms = pgTable("rooms", {
  id: integer("id").primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),

  roundCount: integer("round_count").notNull(),
  roundTime: integer("round_time").notNull(),

  status: roomStatusEnum("status").default("WAITING"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ================= PLAYERS ================= */

export const players = pgTable("players", {
  id: integer("id").primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),

  roomId: integer("room_id").references(() => rooms.id, {
    onDelete: "cascade",
  }),

  status: playerStatusEnum("status").default("ACTIVE"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ================= CATEGORIES ================= */

export const categories = pgTable("categories", {
  id: integer("id").primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ================= ROUNDS ================= */

export const rounds = pgTable("rounds", {
  id: integer("id").primaryKey(),

  roomId: integer("room_id").references(() => rooms.id, {
    onDelete: "cascade",
  }),

  playerId: integer("player_id").references(() => players.id, {
    onDelete: "cascade",
  }),

  roundNumber: integer("round_number").notNull(),
  timeTaken: integer("time_taken"),
  score: integer("score"),

  letter: varchar("letter", { length: 2 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ================= ROUND ANSWERS ================= */

export const roundAnswers = pgTable("round_answers", {
  id: integer("id").primaryKey(),

  roundId: integer("round_id").references(() => rounds.id, {
    onDelete: "cascade",
  }),

  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "cascade",
  }),

  answer: text("answer"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ================= BANNED PLAYERS ================= */

export const bannedPlayers = pgTable("banned_players", {
  id: integer("id").primaryKey(),

  playerId: integer("player_id").references(() => players.id, {
    onDelete: "cascade",
  }),

  reason: text("reason"),

  bannedAt: timestamp("banned_at").defaultNow(),
});
