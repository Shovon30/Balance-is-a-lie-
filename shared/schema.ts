import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const game_stats = pgTable("game_stats", {
  id: serial("id").primaryKey(),
  maxUnlockedLevel: integer("max_unlocked_level").notNull().default(0),
  totalDeaths: integer("total_deaths").default(0),
  totalJumps: integer("total_jumps").default(0),
  totalDashes: integer("total_dashes").default(0),
});

export const insertGameStatsSchema = createInsertSchema(game_stats).omit({ id: true });
export type InsertGameStats = z.infer<typeof insertGameStatsSchema>;
export type GameStats = typeof game_stats.$inferSelect;
