import type { Tables } from "@/integrations/supabase/types";
import { buildDashboardAlerts, COVENANT_MARGIN_POINTS, type DashboardAlert } from "./alerts";
import { monthsSince } from "./format";

export type SourceRibbon = {
  fileName: string;
  templateVersion: string;
  importedAt: string | null;
  asOfDate: string | null;
};

export type LeaseRowDto = {
  unitId: string;
  lot: string;
  floor: string | null;
  tenantName: string | null;
  isVacant: boolean;
  areaSqm: number | null;
  annualRent: number | null;
  endDate: string | null;
  breakDate: string | null;
  indexation: string | null;
  vacantSince: string | null;
  vacantMonths: number | null;
  rentFreeEndDate: string | null;
  securityDeposit: number | null;
  bankGuaranteeAmount: number | null;
  bankGuaranteeExpiry: string | null;
  recoverableCharges: number | null;
  parkingSpaces: number | null;
};

export type LoanInput = Pick<Tables<"loans">,
  "id" | "asset_id" | "import_id" | "lender" | "maturity_date" | "ltv" | "ltv_covenant" |
  "icr" | "icr_covenant" | "interest_rate" | "rate_type" | "reference_index" | "amortization_type"
>;
export type LoanDto = {
  id: string;
  lender: string;
  maturityDate: string | null;
  ltv: number | null;
  ltvCovenant: number | null;
  icr: number | null;
  icrCovenant: number | null;
  interestRate: number | null;
  rateType: string | null;
  referenceIndex: string | null;
  amortizationType: string | null;
  covenantNear: boolean;
  ltvProgress: number | null;
  amberZoneStart: number | null;
};
export type BpDto = {
  id: string;
  versionLabel: string;
  versionDate: string;
  comment: string | null;
  initialYield: number | null;
  targetIrr: number | null;
};

export type AssetSheetDto = {
  fullName: string;
  isAdmin: boolean;
  asset: {
    id: string; name: string; code: string; assetType: string; address: string; city: string;
    areaSqm: number; acquisitionDate: string | null; strategy: string | null;
    unitsCount: number | null; parkingSpaces: number | null; yearBuilt: number | null;
    yearRenovated: number | null; cadastralReference: string | null; description: string | null;
  };
  photoUrl: string | null;
  investor: { name: string; code: string };
  hasData: boolean;
  summary: {
    marketValue: number | null; valuationDate: string | null; annualRent: number | null;
    occupancyRate: number | null; vacantAreaSqm: number | null; ltv: number | null; asOfDate: string | null;
  };
  loans: LoanDto[];
  leases: LeaseRowDto[];
  counts: { activeTenants: number; vacantLots: number };
  bp: BpDto | null;
  previousBpVersions: BpDto[];
  documents: { id: string; name: string; docType: string; uploadedAt: string }[];
  alerts: DashboardAlert[];
  source: SourceRibbon | null;
};

export type AssetSheetInput = {
  asset: Tables<"assets">;
  summary: Tables<"asset_summary"> | null;
  currentImport: Tables<"imports"> | null;
  units: Tables<"units">[];
  leases: (Tables<"leases"> & { tenant: { name: string } | null })[];
  loans: LoanInput[];
  bpVersions: Tables<"bp_versions">[];
};

/** Rules shared by the server reader and unit tests; never mix historical imports. */
export function assembleAssetSheet(input: AssetSheetInput, now = new Date()) {
  const { asset, summary, currentImport } = input;
  const importId = summary?.import_id;
  const hasData = Boolean(importId && currentImport?.id === importId && currentImport.status === "valide");
  const currentLeases = hasData
    ? input.leases.filter((l) => l.asset_id === asset.id && l.import_id === importId && l.is_active)
    : [];
  const currentLoans = hasData
    ? input.loans.filter((l) => l.asset_id === asset.id && l.import_id === importId)
    : [];
  const versions = hasData
    ? input.bpVersions.filter((v) => v.asset_id === asset.id && v.import_id === importId)
      .sort((a, b) => b.version_date.localeCompare(a.version_date) || a.id.localeCompare(b.id))
    : [];
  const units = input.units.filter((u) => u.asset_id === asset.id);
  const leases: LeaseRowDto[] = units.map((unit) => {
    const lease = currentLeases.find((l) => l.unit_id === unit.id);
    return {
      unitId: unit.id, lot: unit.label, floor: unit.floor, tenantName: lease?.tenant?.name ?? null,
      isVacant: !lease, areaSqm: unit.area_sqm, annualRent: lease?.annual_rent ?? null,
      endDate: lease?.end_date ?? null, breakDate: lease?.break_date ?? null,
      indexation: lease?.indexation ?? null, vacantSince: lease ? null : unit.vacant_since,
      vacantMonths: lease ? null : monthsSince(unit.vacant_since, now),
      rentFreeEndDate: lease?.rent_free_end_date ?? null, securityDeposit: lease?.security_deposit ?? null,
      bankGuaranteeAmount: lease?.bank_guarantee_amount ?? null, bankGuaranteeExpiry: lease?.bank_guarantee_expiry ?? null,
      recoverableCharges: lease?.recoverable_charges ?? null, parkingSpaces: lease?.parking_spaces ?? null,
    };
  });
  const loans: LoanDto[] = currentLoans.map((l) => ({
    id: l.id, lender: l.lender, maturityDate: l.maturity_date, ltv: l.ltv, ltvCovenant: l.ltv_covenant,
    icr: l.icr, icrCovenant: l.icr_covenant, interestRate: l.interest_rate, rateType: l.rate_type,
    referenceIndex: l.reference_index, amortizationType: l.amortization_type,
    covenantNear: l.ltv != null && l.ltv_covenant != null && l.ltv >= l.ltv_covenant - COVENANT_MARGIN_POINTS,
    ltvProgress: l.ltv != null && l.ltv_covenant != null && l.ltv_covenant > 0
      ? Math.max(0, Math.min(100, l.ltv / l.ltv_covenant * 100)) : null,
    amberZoneStart: l.ltv_covenant != null && l.ltv_covenant > 0
      ? Math.max(0, (l.ltv_covenant - COVENANT_MARGIN_POINTS) / l.ltv_covenant * 100) : null,
  }));
  const bpDto = (v: Tables<"bp_versions">): BpDto => ({
    id: v.id, versionLabel: v.version_label, versionDate: v.version_date, comment: v.comment,
    initialYield: v.initial_yield, targetIrr: v.target_irr,
  });
  const currentBp = versions.find((v) => v.is_current);
  const alerts = hasData ? buildDashboardAlerts(
    [{ assetId: asset.id, name: asset.name, importId: importId ?? null }],
    currentLeases.map((l) => ({ ...l, tenant_name: l.tenant?.name ?? "" })),
    currentLoans, units, now,
  ) : [];
  const source: SourceRibbon | null = hasData && currentImport ? {
    fileName: currentImport.file_name, templateVersion: currentImport.template_version,
    importedAt: currentImport.imported_at, asOfDate: currentImport.as_of_date,
  } : null;
  return {
    hasData, leases, loans, alerts, source,
    counts: {
      activeTenants: new Set(currentLeases.map((l) => l.tenant_id)).size,
      vacantLots: leases.filter((l) => l.isVacant).length,
    },
    bp: currentBp ? bpDto(currentBp) : null,
    previousBpVersions: versions.filter((v) => !v.is_current).map(bpDto),
    summary: {
      marketValue: hasData ? summary?.market_value ?? null : null,
      valuationDate: hasData ? summary?.valuation_date ?? null : null,
      annualRent: hasData ? summary?.annual_rent ?? null : null,
      occupancyRate: hasData ? summary?.occupancy_rate ?? null : null,
      vacantAreaSqm: hasData ? summary?.vacant_area_sqm ?? null : null,
      ltv: hasData ? summary?.ltv ?? null : null,
      asOfDate: hasData ? summary?.as_of_date ?? null : null,
    },
  };
}

/** Signed storage links returned by the runtime must remain reachable in the browser. */
export function storageUrlForBrowser(url: string, serverBase: string | undefined, browserBase: string | undefined): string {
  if (!serverBase || !browserBase) return url;
  const base = serverBase.replace(/\/+$/, "");
  return url.startsWith(`${base}/`) ? browserBase.replace(/\/+$/, "") + url.slice(base.length) : url;
}