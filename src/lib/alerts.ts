/**
 * Un prêt est considéré « proche du covenant » lorsque son LTV atteint cette
 * fraction du seuil contractuel. Ce ratio est le seul seuil de l'application :
 * il n'existe aucune colonne pour le stocker en base, il devra y être ajouté.
 */
export const COVENANT_PROXIMITY_RATIO = 0.9;

export type AssetAlert =
  | { kind: "covenant"; assetId: string; assetName: string; ltv: number; covenant: number }
  | {
      kind: "echeance";
      assetId: string;
      assetName: string;
      tenantName: string;
      endDate: string;
    }
  | {
      kind: "vacance";
      assetId: string;
      assetName: string;
      areaSqm: number;
      floorLabel: string;
      vacantSince: string;
    };

/** Lignes d'alerte déduites des données : aucune valeur de la maquette n'est recopiée. */
export function buildAlerts(
  assets: { assetId: string; name: string }[],
  loans: { asset_id: string; ltv: number | null; ltv_covenant: number | null }[],
  expiries: { asset_id: string; tenant_name: string; end_date: string }[],
  vacancies: { asset_id: string; area_sqm: number; floor: string | null; vacant_since: string }[],
): AssetAlert[] {
  const alerts: AssetAlert[] = [];
  const nameOf = new Map(assets.map((a) => [a.assetId, a.name]));

  for (const loan of loans) {
    if (loan.ltv == null || loan.ltv_covenant == null) continue;
    if (loan.ltv >= loan.ltv_covenant * COVENANT_PROXIMITY_RATIO) {
      alerts.push({
        kind: "covenant",
        assetId: loan.asset_id,
        assetName: nameOf.get(loan.asset_id) ?? "",
        ltv: loan.ltv,
        covenant: loan.ltv_covenant,
      });
    }
  }

  const upcoming = expiries
    .filter((e) => new Date(`${e.end_date}T00:00:00`).getTime() >= Date.now() - 86_400_000)
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
  if (upcoming[0]) {
    const next = upcoming[0];
    alerts.push({
      kind: "echeance",
      assetId: next.asset_id,
      assetName: nameOf.get(next.asset_id) ?? "",
      tenantName: next.tenant_name,
      endDate: next.end_date,
    });
  }

  for (const unit of vacancies) {
    alerts.push({
      kind: "vacance",
      assetId: unit.asset_id,
      assetName: nameOf.get(unit.asset_id) ?? "",
      areaSqm: unit.area_sqm,
      floorLabel: unit.floor ?? "",
      vacantSince: unit.vacant_since,
    });
  }

  const order = { covenant: 0, echeance: 1, vacance: 2 } as const;
  return alerts.sort(
    (a, b) => order[a.kind] - order[b.kind] || a.assetName.localeCompare(b.assetName, "fr"),
  );
}
