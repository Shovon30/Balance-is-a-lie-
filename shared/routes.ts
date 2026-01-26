import { z } from 'zod';
import { insertGameStatsSchema, game_stats } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.custom<typeof game_stats.$inferSelect>(),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/stats',
      input: insertGameStatsSchema,
      responses: {
        200: z.custom<typeof game_stats.$inferSelect>(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type GameStatsResponse = z.infer<typeof api.stats.get.responses[200]>;
export type UpdateGameStatsRequest = z.infer<typeof api.stats.update.input>;
