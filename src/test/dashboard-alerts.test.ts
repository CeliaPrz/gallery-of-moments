import { describe, expect, it } from "vitest";
import { buildDashboardAlerts } from "@/lib/alerts";

const NOW = new Date("2026-10-25T12:00:00");
const assets = [{ assetId: "a", name: "Actif A", importId: "imp1" }];
const lease = (o: Partial<{ end_date: string | null; break_date: string | null; is_active: boolean; import_id: string }>) => ({
  asset_id: "a", import_id: "imp1", is_active: true, end_date: null, break_date: null, tenant_name: "T", ...o,
});

describe("alertes du tableau de bord", () => {
  it("signale une échéance dans les 12 prochains mois", () => {
    const r = buildDashboardAlerts(assets, [lease({ end_date: "2027-10-01" })], [], [], NOW);
    expect(r[0]).toMatchObject({ kind: "bail", event: "echeance", date: "2027-10-01" });
  });
  it("ignore une échéance au-delà de 12 mois", () => {
    expect(buildDashboardAlerts(assets, [lease({ end_date: "2027-11-30" })], [], [], NOW)).toEqual([]);
  });
  it("signale une option de sortie dans les 12 mois", () => {
    const r = buildDashboardAlerts(assets, [lease({ end_date: "2030-01-01", break_date: "2027-03-01" })], [], [], NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ event: "sortie" });
  });
  it("ignore un bail inactif ou d'un ancien import", () => {
    expect(buildDashboardAlerts(assets, [lease({ end_date: "2027-01-01", is_active: false }), lease({ end_date: "2027-01-01", import_id: "old" })], [], [], NOW)).toEqual([]);
  });
  it("signale une LTV à covenant moins 5 points", () => {
    const loan = (ltv: number) => [{ asset_id: "a", import_id: "imp1", ltv, ltv_covenant: 55 }];
    expect(buildDashboardAlerts(assets, [], loan(50), [], NOW)).toHaveLength(1);
    expect(buildDashboardAlerts(assets, [], loan(49.9), [], NOW)).toEqual([]);
  });
  it("compte les mois de vacance", () => {
    const r = buildDashboardAlerts(assets, [], [], [{ asset_id: "a", label: "L3", vacant_since: "2026-04-10" }], NOW);
    expect(r[0]).toMatchObject({ kind: "vacance", label: "L3", months: 6 });
  });
});
