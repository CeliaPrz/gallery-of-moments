import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth" });
    }
    // Compte désactivé : aucune donnée visible, déconnexion immédiate.
    const { data: profile } = await supabase
      .from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { desactive: "1" } });
    }
  },
  component: () => <Outlet />,
});
