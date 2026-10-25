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

// ---- Règles du tableau de bord (étape 2) ----

/** Une échéance ou option de sortie est signalée si elle tombe dans ce nombre de mois. */
export const LEASE_ALERT_MONTHS = 12;
/** Un prêt est signalé quand sa LTV atteint le covenant moins ce nombre de points. */
export const COVENANT_MARGIN_POINTS = 5;

export type DashboardAlert =
  | {
      kind: "bail";
      assetId: string;
      assetName: string;
      tenantName: string;
      event: "echeance" | "sortie";
      date: string;
    }
  | { kind: "financement"; assetId: string; assetName: string; ltv: number; covenant: number }
  | { kind: "vacance"; assetId: string; assetName: string; label: string; months: number };

type CurrentAsset = { assetId: string; name: string; importId: string | null };

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Alertes lues uniquement sur l'import en vigueur de chaque actif. */
export function buildDashboardAlerts(
  assets: CurrentAsset[],
  leases: {
    asset_id: string;
    import_id: string;
    is_active: boolean;
    end_date: string | null;
    break_date: string | null;
    tenant_name: string;
  }[],
  loans: { asset_id: string; import_id: string; ltv: number | null; ltv_covenant: number | null }[],
  units: { asset_id: string; label: string; vacant_since: string | null }[],
  now = new Date(),
): DashboardAlert[] {
  const byId = new Map(assets.map((a) => [a.assetId, a]));
  const isCurrent = (assetId: string, importId: string) =>
    byId.get(assetId)?.importId === importId;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const limit = addMonths(today, LEASE_ALERT_MONTHS);
  const inWindow = (value: string | null) => {
    if (!value) return false;
    const d = new Date(`${value.slice(0, 10)}T00:00:00`);
    return d >= today && d <= limit;
  };

  const alerts: DashboardAlert[] = [];

  for (const lease of leases) {
    if (!lease.is_active || !isCurrent(lease.asset_id, lease.import_id)) continue;
    const assetName = byId.get(lease.asset_id)!.name;
    if (inWindow(lease.break_date)) {
      alerts.push({ kind: "bail", assetId: lease.asset_id, assetName, tenantName: lease.tenant_name, event: "sortie", date: lease.break_date! });
    }
    if (inWindow(lease.end_date)) {
      alerts.push({ kind: "bail", assetId: lease.asset_id, assetName, tenantName: lease.tenant_name, event: "echeance", date: lease.end_date! });
    }
  }

  for (const loan of loans) {
    if (!isCurrent(loan.asset_id, loan.import_id)) continue;
    if (loan.ltv == null || loan.ltv_covenant == null) continue;
    if (loan.ltv >= loan.ltv_covenant - COVENANT_MARGIN_POINTS) {
      alerts.push({ kind: "financement", assetId: loan.asset_id, assetName: byId.get(loan.asset_id)!.name, ltv: loan.ltv, covenant: loan.ltv_covenant });
    }
  }

  for (const unit of units) {
    if (!unit.vacant_since || !byId.has(unit.asset_id)) continue;
    const start = new Date(`${unit.vacant_since.slice(0, 10)}T00:00:00`);
    const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
    alerts.push({ kind: "vacance", assetId: unit.asset_id, assetName: byId.get(unit.asset_id)!.name, label: unit.label, months });
  }

  const order = { bail: 0, financement: 1, vacance: 2 } as const;
  return alerts.sort((a, b) => order[a.kind] - order[b.kind] || a.assetName.localeCompare(b.assetName, "fr"));
}
