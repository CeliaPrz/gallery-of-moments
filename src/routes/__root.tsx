import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import inter500 from "@fontsource/inter/files/inter-latin-500-normal.woff2?url";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";
import manrope600 from "@fontsource/manrope/files/manrope-latin-600-normal.woff2?url";
import manrope700 from "@fontsource/manrope/files/manrope-latin-700-normal.woff2?url";

function RootComponent() {
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="preload" as="font" type="font/woff2" href={inter400} crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href={inter500} crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href={inter600} crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href={manrope600} crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href={manrope700} crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href={appCss}
        />
        <title>LUR — Gestion d'actifs immobiliers</title>
        <meta
          name="description"
          content="Portail institutionnel de gestion d'actifs immobiliers : portefeuille, baux, financement et business plan, à jour et traçable."
        />
        <meta property="og:title" content="LUR — Gestion d'actifs immobiliers" />
        <meta
          property="og:description"
          content="Portail institutionnel de gestion d'actifs immobiliers : portefeuille, baux, financement et business plan, à jour et traçable."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Toaster position="top-right" richColors />
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => {
    const { queryClient } = Route.useRouteContext();

    return (
      <QueryClientProvider client={queryClient}>
        <RootComponent />
      </QueryClientProvider>
    );
  },
});
