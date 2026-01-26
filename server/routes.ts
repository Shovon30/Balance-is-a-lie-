import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get(api.stats.get.path, async (req, res) => {
    const stats = await storage.getStats();
    // Return empty stats if none exist yet, or the stats object
    res.json(stats || { maxUnlockedLevel: 0, totalDeaths: 0, totalJumps: 0, totalDashes: 0 });
  });

  app.post(api.stats.update.path, async (req, res) => {
    try {
      const input = api.stats.update.input.parse(req.body);
      const updated = await storage.updateStats(input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  return httpServer;
}
