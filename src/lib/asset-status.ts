/** Règles pures sur les actifs sortis et l'anonymisation (testables sans serveur). */
export const ANONYMIZED_TENANT_NAME = "Locataire anonymisé";

export type ExitReason = "vente" | "fin_de_mandat";

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  vente: "Vente",
  fin_de_mandat: "Fin de mandat",
};

export function exitReasonLabel(reason: string | null | undefined): string {
  return reason && reason in EXIT_REASON_LABELS ? EXIT_REASON_LABELS[reason as ExitReason] : "—";
}

export function isExited(status: string | null | undefined): boolean {
  return status === "sorti";
}

/** Sépare les actifs en portefeuille des actifs sortis ; ces derniers sont exclus des alertes et des loyers. */
export function splitByStatus<T extends { assetId: string }>(rows: T[], exitedIds: Set<string>) {
  return {
    active: rows.filter((r) => !exitedIds.has(r.assetId)),
    exited: rows.filter((r) => exitedIds.has(r.assetId)),
  };
}

/** Valeurs écrites lors d'une anonymisation (contacts supprimés à part). */
export function anonymizedTenantPatch(now = new Date()) {
  return { name: ANONYMIZED_TENANT_NAME, tax_id: null, anonymized_at: now.toISOString() };
}
