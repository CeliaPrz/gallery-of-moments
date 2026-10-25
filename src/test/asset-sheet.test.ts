import { describe, expect, it } from "vitest";
import { assembleAssetSheet, storageUrlForBrowser, type AssetSheetInput } from "@/lib/asset-sheet";
import { buildDashboardAlerts } from "@/lib/alerts";

function required<T>(values: T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error(`Missing fixture at ${index}`);
  return value;
}

const NOW = new Date("2026-10-25T12:00:00");
const fixture = (): AssetSheetInput => ({
  asset: {
    id: "a", investor_id: "investor", code: "A", name: "Actif test", asset_type: "Bureaux",
    address: "Adresse test", city: "Ville test", lettable_area_sqm: 300, acquisition_date: null,
    strategy: null, units_count: 2, parking_spaces: 0, year_built: null, year_renovated: null,
    cadastral_reference: null, description: null, photo_path: null, postal_code: null,
    created_at: "2026-01-01", updated_at: "2026-01-01",
  },
  summary: {
    asset_id: "a", import_id: "current", investor_id: "investor", code: "A", name: "Actif test",
    city: "Ville test", lettable_area_sqm: 300, as_of_date: "2026-10-01", market_value: 1250000,
    annual_rent: 90000, occupancy_rate: 70, ltv: 50, total_debt: 625000, vacant_area_sqm: 100,
    valuation_date: "2026-09-01", walb_years: null, walt_years: null,
  },
  currentImport: {
    id: "current", investor_id: "investor", file_name: "current.xlsx", template_version: "v3",
    imported_at: "2026-10-02T10:00:00Z", as_of_date: "2026-10-01", status: "valide",
    file_path: null, imported_by: null, notes: null, replaced_by: null,
  },
  units: [
    { id: "u1", asset_id: "a", label: "Lot 1", floor: "1", area_sqm: 200, use_type: null, vacant_since: null },
    { id: "u2", asset_id: "a", label: "Lot 2", floor: "2", area_sqm: 100, use_type: null, vacant_since: "2026-04-10" },
  ],
  leases: [{
    id: "lease", asset_id: "a", unit_id: "u1", tenant_id: "tenant", import_id: "current",
    start_date: "2025-01-01", end_date: "2027-10-01", break_date: "2027-03-01", annual_rent: 90000,
    indexation: "ILC", area_sqm: 195, is_active: true, parking_spaces: 0,
    rent_free_months: 3, rent_free_end_date: "2025-04-01", security_deposit: 7500,
    bank_guarantee_amount: 15000, bank_guarantee_expiry: "2027-12-31", recoverable_charges: 4000,
    tenant: { name: "Locataire test" },
  }],
  loans: [{
    id: "loan1", asset_id: "a", import_id: "current", lender: "Prêteur test", maturity_date: "2030-01-01",
    ltv: 50, ltv_covenant: 55, icr: 2.1, icr_covenant: 1.5, interest_rate: 3.5,
    rate_type: "variable", reference_index: "EURIBOR", amortization_type: "in fine",
  }],
  bpVersions: [
    { id: "bp1", asset_id: "a", import_id: "current", version_label: "V1", version_date: "2026-01-01", is_current: false, initial_yield: 4, target_irr: 6, comment: null },
    { id: "bp3", asset_id: "a", import_id: "current", version_label: "V3", version_date: "2026-10-01", is_current: true, initial_yield: 5, target_irr: 7, comment: "Commentaire" },
    { id: "bp2", asset_id: "a", import_id: "current", version_label: "V2", version_date: "2026-06-01", is_current: false, initial_yield: 4.5, target_irr: 6.5, comment: null },
  ],
});

describe("fiche actif : import en vigueur", () => {
  it("ne retient que les baux actifs de l'import en vigueur", () => {
    const input = fixture();
    input.leases.unshift({ ...required(input.leases, 0), id: "historical", import_id: "old", annual_rent: 1 });
    input.leases.unshift({ ...required(input.leases, 1), id: "inactive", is_active: false, unit_id: "u2" });
    const result = assembleAssetSheet(input, NOW);
    expect(result.leases).toHaveLength(2);
    expect(result.leases[0]).toMatchObject({ unitId: "u1", annualRent: 90000, tenantName: "Locataire test" });
    expect(result.leases[1]).toMatchObject({ unitId: "u2", isVacant: true, annualRent: null });
  });
  it("produit exactement une ligne par lot avec les champs complets du bail", () => {
    const input = fixture();
    input.leases.push({ ...required(input.leases, 0), id: "duplicate" });
    const result = assembleAssetSheet(input, NOW);
    expect(result.leases).toHaveLength(input.units.length);
    expect(result.leases[0]).toMatchObject({
      areaSqm: 200, rentFreeEndDate: "2025-04-01", securityDeposit: 7500,
      bankGuaranteeAmount: 15000, bankGuaranteeExpiry: "2027-12-31", recoverableCharges: 4000, parkingSpaces: 0,
    });
  });
  it("calcule la vacance du lot sans inventer zéro pour une date absente", () => {
    const input = fixture();
    expect(required(assembleAssetSheet(input, NOW).leases, 1).vacantMonths).toBe(6);
    required(input.units, 1).vacant_since = null;
    expect(required(assembleAssetSheet(input, NOW).leases, 1).vacantMonths).toBeNull();
  });
  it("retient tous les prêts et seulement ceux de l'import en vigueur", () => {
    const input = fixture();
    input.loans.push({ ...required(input.loans, 0), id: "loan2" }, { ...required(input.loans, 0), id: "old", import_id: "old" });
    expect(assembleAssetSheet(input, NOW).loans.map((l) => l.id)).toEqual(["loan1", "loan2"]);
  });
  it("transmet l'encours de chaque prêt sans jamais l'agréger au niveau du portefeuille", () => {
    const result = assembleAssetSheet(fixture(), NOW);
    expect(required(result.loans, 0)).toHaveProperty("outstanding", 625000);
    expect(result).not.toHaveProperty("totalOutstanding");
    expect(result.summary).not.toHaveProperty("totalDebt");
  });
  it("utilise la zone ambre à covenant moins 5 points, sans division par zéro", () => {
    const input = fixture();
    expect(required(assembleAssetSheet(input, NOW).loans, 0).covenantNear).toBe(true);
    required(input.loans, 0).ltv = 49.9;
    expect(required(assembleAssetSheet(input, NOW).loans, 0).covenantNear).toBe(false);
    required(input.loans, 0).ltv_covenant = 0;
    expect(required(assembleAssetSheet(input, NOW).loans, 0).ltvProgress).toBeNull();
  });
  it("reprend exactement toutes les alertes du tableau de bord pour cet actif", () => {
    const input = fixture();
    const result = assembleAssetSheet(input, NOW);
    const expected = buildDashboardAlerts([{ assetId: "a", name: "Actif test", importId: "current" }],
      input.leases.map((l) => ({ ...l, tenant_name: l.tenant?.name ?? "" })), input.loans, input.units, NOW);
    expect(result.alerts).toEqual(expected);
    expect(result.alerts).toHaveLength(4);
  });
  it("affiche le BP courant et les précédents du même import par date décroissante", () => {
    const input = fixture();
    input.bpVersions.push({ ...required(input.bpVersions, 1), id: "old", import_id: "old", version_date: "2027-01-01" });
    const result = assembleAssetSheet(input, NOW);
    expect(result.bp?.id).toBe("bp3");
    expect(result.previousBpVersions.map((v) => v.id)).toEqual(["bp2", "bp1"]);
  });
  it("ne montre aucun chiffre d'import non validé", () => {
    const input = fixture();
    if (input.currentImport) input.currentImport.status = "en_attente";
    const result = assembleAssetSheet(input, NOW);
    expect(result.hasData).toBe(false);
    expect(result.summary.marketValue).toBeNull();
    expect(result.loans).toEqual([]);
    expect(result.bp).toBeNull();
    expect(result.alerts).toEqual([]);
    expect(result.source).toBeNull();
  });
  it("garde la source exacte de l'import identifié dans asset_summary", () => {
    expect(assembleAssetSheet(fixture(), NOW).source).toEqual({
      fileName: "current.xlsx", templateVersion: "v3", importedAt: "2026-10-02T10:00:00Z", asOfDate: "2026-10-01",
    });
  });
});

describe("liens signés du stockage", () => {
  it("garde le chemin et la signature en utilisant l'origine accessible au navigateur", () => {
    expect(storageUrlForBrowser("http://runtime/storage/v1/object/sign/asset-photos/a.jpg?token=test", "http://runtime/", "https://public.example/"))
      .toBe("https://public.example/storage/v1/object/sign/asset-photos/a.jpg?token=test");
  });
  it("ne réécrit pas les liens d'une origine différente", () => {
    expect(storageUrlForBrowser("https://other.example/path", "http://runtime", "https://public.example"))
      .toBe("https://other.example/path");
  });
});