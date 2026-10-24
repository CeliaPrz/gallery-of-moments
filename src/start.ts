import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { supabase } from "./integrations/supabase/client";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installe cette protection automatiquement quand src/start.ts est absent ;
// définir le fichier désactive l'installation automatique, on la réajoute donc
// explicitement pour protéger les fonctions serveur des requêtes cross-site.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Attache le jeton de session Supabase aux appels de fonctions serveur, afin que
// les règles de sécurité en base s'appliquent au nom de l'utilisateur connecté.
const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return next();
  }
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
