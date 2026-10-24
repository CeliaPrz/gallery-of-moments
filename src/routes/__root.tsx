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

import appSvg from "./assets/eslint.svg";
import appCss from "./styles.css?url";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin={"anonymous"}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <link
          rel="stylesheet"
          href={appCss}
        />
        <link rel="icon" href={appSvg} type="image/svg+xml" />
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
