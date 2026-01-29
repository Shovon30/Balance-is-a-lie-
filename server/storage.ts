import { db } from "./db";
import { game_stats, type InsertGameStats, type GameStats } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getStats(): Promise<GameStats | undefined>;
  updateStats(stats: InsertGameStats): Promise<GameStats>;
}

export class DatabaseStorage implements IStorage {
  async getStats(): Promise<GameStats | undefined> {
    // Return the first record, or undefined if none
    const stats = await db.select().from(game_stats).limit(1);
    return stats[0];
  }

  async updateStats(insertStats: InsertGameStats): Promise<GameStats> {
    // For this simple game, we'll just maintain a single "global" stats record for simplicity
    // or update the existing one if it exists
    const existing = await this.getStats();
    
    if (existing) {
        // Update logic: keep maxUnlockedLevel, sum up others
        const [updated] = await db.update(game_stats)
            .set({
                maxUnlockedLevel: Math.max(existing.maxUnlockedLevel, insertStats.maxUnlockedLevel || 0),
                totalDeaths: (existing.totalDeaths || 0) + (insertStats.totalDeaths || 0),
                totalJumps: (existing.totalJumps || 0) + (insertStats.totalJumps || 0),
                totalDashes: (existing.totalDashes || 0) + (insertStats.totalDashes || 0),
            })
            .where(eq(game_stats.id, existing.id))
            .returning();
        return updated;
    } else {
        const [created] = await db.insert(game_stats).values(insertStats).returning();
        return created;
    }
  }
}

export const storage = new DatabaseStorage();
