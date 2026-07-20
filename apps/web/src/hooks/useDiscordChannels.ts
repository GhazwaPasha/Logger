import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import type { DiscordChannelOption } from "@/lib/ledger-types";
import { discordKeys } from "@/lib/query-keys";

/** Live channel list for the workspace's connected Discord server; empty when Discord isn't configured. */
export function useDiscordChannels(token: string | null, organizationId: string) {
  return useQuery({
    queryKey: discordKeys.channels(organizationId),
    queryFn: () => apiJson<DiscordChannelOption[]>(`/organizations/${organizationId}/discord-channels`, { token }),
    enabled: Boolean(token && organizationId),
    staleTime: 30_000,
  });
}
