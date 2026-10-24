import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Enregistre la référence d'un fichier déposé dans la table imports, avec le
 * statut « en_attente » : la ligne atteste du dépôt, elle ne modifie aucun
 * chiffre du portefeuille. Seule l'administratrice peut déposer un import.
 */
export const recordImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = input as {
      investorId?: string;
      fileName?: string;
      templateVersion?: string;
      asOfDate?: string;
    };
    if (!value?.investorId || !value?.fileName || !value?.templateVersion || !value?.asOfDate) {
      throw new Error("Informations d'import incomplètes.");
    }
    return {
      investorId: value.investorId,
      fileName: value.fileName,
      templateVersion: value.templateVersion,
      asOfDate: value.asOfDate,
    };
  })
  .handler(async ({ context, data }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.role !== "admin") {
      throw new Error("Dépôt réservé à l'administratrice.");
    }

    const { data: created, error } = await context.supabase
      .from("imports")
      .insert({
        investor_id: data.investorId,
        file_name: data.fileName,
        template_version: data.templateVersion,
        as_of_date: data.asOfDate,
        status: "en_attente",
        imported_by: context.userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return { importId: created.id };
  });
