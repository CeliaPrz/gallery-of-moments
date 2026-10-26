import { queryOptions } from "@tanstack/react-query";

import { getSidebarAssets } from "@/lib/lur.functions";

export const sidebarAssetsQueryOptions = queryOptions({
  queryKey: ["sidebar-assets"],
  queryFn: () => getSidebarAssets(),
  staleTime: 5 * 60 * 1000,
});
