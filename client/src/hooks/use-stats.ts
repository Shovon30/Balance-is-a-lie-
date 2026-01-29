import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type GameStatsResponse, type UpdateGameStatsRequest } from "@shared/routes";

export function useGameStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch game stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateGameStats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateGameStatsRequest) => {
      const res = await fetch(api.stats.update.path, {
        method: api.stats.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update game stats");
      return api.stats.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stats.get.path] });
    },
  });
}
