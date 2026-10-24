import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAlerts, type AssetAlert } from "./alerts";


export type SourceRibbon = {
  fileName: string;
  templateVersion: string;
  importedAt: string | null;
  asOfDate: string | null;
};


export type DashboardAssetRow = {
  assetId: string;
  name: string;
  city: string;
  areaSqm: number | null;
  marketValue: number | null;
  occupancyRate: number | null;
  ltv: number | null;
  ltvCovenant: number | null;
  nextExpiry: string | null;
  updatedAt: string | null;
};

export type DashboardDto = {
  fullName: string;
  investorName: string;
  investorCode: string;
  isAdmin: boolean;
  latestDataDate: string | null;
  totalValue: number | null;
  totalAnnualRent: number | null;
  occupancyRate: number | null;
  portfolioLtv: number | null;
  assetsCount: number | null;
  assets: DashboardAssetRow[];
  alerts: AssetAlert[];
  rentBars: { assetId: string; name: string; rent: number }[];
  lastReport: { periodLabel: string; validatedAt: string | null; pdfPath: string | null } | null;
  source: SourceRibbon | null;
};

export type LeaseRowDto = {
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
};

export type AssetSheetDto = {
  fullName: string;
  isAdmin: boolean;
  asset: {
    id: string;
    name: string;
    code: string;
    assetType: string;
    address: string;
    city: string;
    areaSqm: number;
    acquisitionDate: string | null;
    strategy: string | null;
  };
  investor: { name: string; code: string };
  summary: {
    marketValue: number | null;
    valuationDate: string | null;
    annualRent: number | null;
    occupancyRate: number | null;
    vacantAreaSqm: number | null;
    ltv: number | null;
    totalDebt: number | null;
    asOfDate: string | null;
  };
  loan: {
    lender: string;
    outstanding: number;
    maturityDate: string | null;
    ltv: number | null;
    ltvCovenant: number | null;
    icr: number | null;
    icrCovenant: number | null;
    amortizationType: string | null;
    interestRate: number | null;
    rateType: string | null;
    referenceIndex: string | null;
  } | null;
  leases: LeaseRowDto[];
  counts: { activeTenants: number; vacantLots: number };
  bp: {
    versionLabel: string;
    versionDate: string;
    comment: string | null;
    initialYield: number | null;
    targetIrr: number | null;
    previousCount: number;
  } | null;
  alerts: AssetAlert[];
  source: SourceRibbon | null;
};

export type ImportDto = {
  investors: { id: string; code: string; name: string; assetsCount: number }[];
  selectedInvestorId: string | null;
  schemaVersion: string | null;
  schemaUpdatedAt: string | null;
  lastImports: {
    id: string;
    fileName: string;
    templateVersion: string;
    importedAt: string;
    status: string;
    notes: string | null;
    importedBy: string | null;
  }[];
  preview: {
    assetId: string;
    name: string;
    marketValue: number | null;
    annualRent: number | null;
    ltv: number | null;
    ltvCovenant: number | null;
  }[];
  counts: { assets: number; units: number; leases: number; tenants: number; loans: number; bpVersions: number };
};


async function loadSource(supabase: any, importId: string | null): Promise<SourceRibbon | null> {
  if (!importId) return null;
  const { data } = await supabase
    .from("imports")
    .select("file_name, template_version, imported_at, as_of_date")
    .eq("id", importId)
    .maybeSingle();
  if (!data) return null;
  return {
    fileName: data.file_name,
    templateVersion: data.template_version,
    importedAt: data.imported_at,
    asOfDate: data.as_of_date,
  };
}


export const whoami = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, role, investor_id")
      .eq("id", context.userId)
      .maybeSingle();

    let investor: { name: string; code: string } | null = null;
    if (profile?.investor_id) {
      const { data } = await context.supabase
        .from("investors")
        .select("name, code")
        .eq("id", profile.investor_id)
        .maybeSingle();
      if (data) investor = data;
    }

    return {
      userId: context.userId,
      fullName: profile?.full_name ?? "",
      role: profile?.role ?? "investor",
      investorId: profile?.investor_id ?? null,
      investor,
    };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardDto> => {
    const supabase = context.supabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, investor_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: investorList } = await supabase
      .from("investors")
      .select("id, name, code")
      .order("code");

    const { data: portfolios } = await supabase
      .from("portfolio_summary")
      .select(
        "investor_id, assets_count, latest_data_date, total_value, total_annual_rent, occupancy_rate, portfolio_ltv",
      );

    // L'administratrice n'est rattachée à aucun fonds : elle consulte le premier
    // portefeuille par ordre de code.
    const targetId = profile?.investor_id ?? investorList?.[0]?.id ?? null;
    const portfolio = portfolios?.find((p) => p.investor_id === targetId) ?? portfolios?.[0];
    const investorId = portfolio?.investor_id ?? targetId;
    const investor = investorList?.find((row) => row.id === investorId) ?? null;

    const { data: summaries } = await supabase
      .from("asset_summary")
      .select(
        "asset_id, name, city, lettable_area_sqm, market_value, occupancy_rate, ltv, annual_rent, vacant_area_sqm, import_id, investor_id",
      )
      .order("name");

    const rows = (investorId
      ? summaries?.filter((s) => s.investor_id === investorId)
      : summaries) ?? [];

    const assetIds = rows.map((r) => r.asset_id).filter((id): id is string => Boolean(id));

    const { data: loans } = await supabase
      .from("loans")
      .select("asset_id, ltv, ltv_covenant")
      .in("asset_id", assetIds.length ? assetIds : ["00000000-0000-0000-0000-000000000000"]);

    const { data: expiries } = await supabase
      .from("leases")
      .select("asset_id, end_date, tenant:tenants(name)")
      .eq("is_active", true)
      .in("asset_id", assetIds.length ? assetIds : ["00000000-0000-0000-0000-000000000000"]);

    const { data: vacancies } = await supabase
      .from("units")
      .select("asset_id, area_sqm, floor, vacant_since")
      .not("vacant_since", "is", null)
      .in("asset_id", assetIds.length ? assetIds : ["00000000-0000-0000-0000-000000000000"]);

    const expiryByAsset = new Map<string, string>();
    for (const lease of expiries ?? []) {
      const assetId = lease.asset_id as string;
      const current = expiryByAsset.get(assetId);
      if (!current || lease.end_date < current) expiryByAsset.set(assetId, lease.end_date);
    }

    const importIds = rows.map((r) => r.import_id).filter((id): id is string => Boolean(id));
    const { data: importRows } = await supabase
      .from("imports")
      .select("id, imported_at")
      .in("id", importIds.length ? importIds : ["00000000-0000-0000-0000-000000000000"]);
    const importedAtById = new Map((importRows ?? []).map((i) => [i.id, i.imported_at]));

    const assets: DashboardAssetRow[] = rows.map((row) => ({
      assetId: row.asset_id as string,
      name: row.name as string,
      city: row.city as string,
      areaSqm: row.lettable_area_sqm,
      marketValue: row.market_value,
      occupancyRate: row.occupancy_rate,
      ltv: row.ltv,
      ltvCovenant: loans?.find((l) => l.asset_id === row.asset_id)?.ltv_covenant ?? null,
      nextExpiry: expiryByAsset.get(row.asset_id as string) ?? null,
      updatedAt: row.import_id ? (importedAtById.get(row.import_id) ?? null) : null,
    }));

    const alerts = buildAlerts(
      rows.map((r) => ({
        assetId: r.asset_id as string,
        name: r.name as string,
        vacantAreaSqm: r.vacant_area_sqm,
      })),
      loans ?? [],
      (expiries ?? [])
        .filter((e) => e.end_date && (e as any).tenant?.name)
        .map((e) => ({
          asset_id: e.asset_id as string,
          tenant_name: (e as any).tenant.name as string,
          end_date: e.end_date,
        })),
      (vacancies ?? [])
        .filter((v) => v.vacant_since)
        .map((v) => ({
          asset_id: v.asset_id as string,
          area_sqm: Number(v.area_sqm),
          floor: v.floor,
          vacant_since: v.vacant_since as string,
        })),
    );

    const rentBars = rows
      .filter((r) => r.annual_rent != null)
      .map((r) => ({
        assetId: r.asset_id as string,
        name: r.name as string,
        rent: Number(r.annual_rent),
      }))
      .sort((a, b) => b.rent - a.rent);

    const { data: report } = await supabase
      .from("reports")
      .select("period_label, validated_at, pdf_path")
      .in("status", ["valide", "envoye"])
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sourceImportId = rows.find((r) => r.import_id)?.import_id ?? null;

    return {
      fullName: profile?.full_name ?? "",
      investorName: investor?.name ?? "",
      investorCode: investor?.code ?? "",
      isAdmin: profile?.role === "admin",
      latestDataDate: portfolio?.latest_data_date ?? null,
      totalValue: portfolio?.total_value ?? null,
      totalAnnualRent: portfolio?.total_annual_rent ?? null,
      occupancyRate: portfolio?.occupancy_rate ?? null,
      portfolioLtv: portfolio?.portfolio_ltv ?? null,
      assetsCount: portfolio?.assets_count ?? rows.length,
      assets,
      alerts,
      rentBars,
      lastReport: report
        ? {
            periodLabel: report.period_label,
            validatedAt: report.validated_at,
            pdfPath: report.pdf_path,
          }
        : null,
      source: await loadSource(supabase, sourceImportId),
    };
  });

export const getAssetSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((assetId: string) => assetId)
  .handler(async ({ context, data: assetId }): Promise<AssetSheetDto> => {
    const supabase = context.supabase;

    const { data: asset } = await supabase
      .from("assets")
      .select(
        "id, name, code, asset_type, address, city, lettable_area_sqm, acquisition_date, strategy, investor_id",
      )
      .eq("id", assetId)
      .maybeSingle();

    if (!asset) throw new Error("Actif introuvable ou non autorisé.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: summary } = await supabase
      .from("asset_summary")
      .select(
        "market_value, valuation_date, annual_rent, occupancy_rate, vacant_area_sqm, ltv, total_debt, as_of_date, import_id",
      )
      .eq("asset_id", assetId)
      .maybeSingle();

    const { data: investor } = await supabase
      .from("investors")
      .select("name, code")
      .eq("id", asset.investor_id)
      .maybeSingle();

    const { data: loan } = await supabase
      .from("loans")
      .select(
        "lender, outstanding, maturity_date, ltv, ltv_covenant, icr, icr_covenant, amortization_type, interest_rate, rate_type, reference_index",
      )
      .eq("asset_id", assetId)
      .maybeSingle();

    const { data: leaseRows } = await supabase
      .from("leases")
      .select(
        "annual_rent, end_date, break_date, indexation, area_sqm, is_active, unit:units(label, floor), tenant:tenants(name)",
      )
      .eq("asset_id", assetId)
      .eq("is_active", true);

    const { data: vacantUnits } = await supabase
      .from("units")
      .select("label, floor, area_sqm, vacant_since")
      .eq("asset_id", assetId)
      .not("vacant_since", "is", null);

    const { data: bpCurrent } = await supabase
      .from("bp_versions")
      .select("version_label, version_date, comment, initial_yield, target_irr")
      .eq("asset_id", assetId)
      .eq("is_current", true)
      .maybeSingle();

    const { count: previousCount } = await supabase
      .from("bp_versions")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", assetId)
      .eq("is_current", false);

    const leases: LeaseRowDto[] = (leaseRows ?? []).map((row: any) => ({
      lot: row.unit?.label ?? "",
      floor: row.unit?.floor ?? null,
      tenantName: row.tenant?.name ?? null,
      isVacant: false,
      areaSqm: row.area_sqm ?? row.unit?.area_sqm ?? null,
      annualRent: row.annual_rent,
      endDate: row.end_date,
      breakDate: row.break_date,
      indexation: row.indexation,
      vacantSince: null,
    }));

    for (const unit of vacantUnits ?? []) {
      leases.push({
        lot: unit.label,
        floor: unit.floor,
        tenantName: null,
        isVacant: true,
        areaSqm: unit.area_sqm,
        annualRent: null,
        endDate: null,
        breakDate: null,
        indexation: null,
        vacantSince: unit.vacant_since,
      });
    }

    const alerts = buildAlerts(
      [{ assetId, name: asset.name }],
      loan ? [{ asset_id: assetId, ltv: loan.ltv, ltv_covenant: loan.ltv_covenant }] : [],
      (leaseRows ?? [])
        .filter((row: any) => row.end_date && row.tenant?.name)
        .map((row: any) => ({
          asset_id: assetId,
          tenant_name: row.tenant.name as string,
          end_date: row.end_date as string,
        })),
      (vacantUnits ?? [])
        .filter((u) => u.vacant_since)
        .map((u) => ({
          asset_id: assetId,
          area_sqm: Number(u.area_sqm),
          floor: u.floor,
          vacant_since: u.vacant_since as string,
        })),
    );

    return {
      fullName: profile?.full_name ?? "",
      isAdmin: profile?.role === "admin",
      asset: {
        id: asset.id,
        name: asset.name,
        code: asset.code,
        assetType: asset.asset_type,
        address: asset.address,
        city: asset.city,
        areaSqm: asset.lettable_area_sqm,
        acquisitionDate: asset.acquisition_date,
        strategy: asset.strategy,
      },
      investor: { name: investor?.name ?? "", code: investor?.code ?? "" },
      summary: {
        marketValue: summary?.market_value ?? null,
        valuationDate: summary?.valuation_date ?? null,
        annualRent: summary?.annual_rent ?? null,
        occupancyRate: summary?.occupancy_rate ?? null,
        vacantAreaSqm: summary?.vacant_area_sqm ?? null,
        ltv: summary?.ltv ?? null,
        totalDebt: summary?.total_debt ?? null,
        asOfDate: summary?.as_of_date ?? null,
      },
      loan: loan
        ? {
            lender: loan.lender,
            outstanding: Number(loan.outstanding),
            maturityDate: loan.maturity_date,
            ltv: loan.ltv,
            ltvCovenant: loan.ltv_covenant,
            icr: loan.icr,
            icrCovenant: loan.icr_covenant,
            amortizationType: loan.amortization_type,
            interestRate: loan.interest_rate,
            rateType: loan.rate_type,
            referenceIndex: loan.reference_index,
          }
        : null,
      leases,
      counts: {
        activeTenants: (leaseRows ?? []).length,
        vacantLots: (vacantUnits ?? []).length,
      },
      bp: bpCurrent
        ? {
            versionLabel: bpCurrent.version_label,
            versionDate: bpCurrent.version_date,
            comment: bpCurrent.comment,
            initialYield: bpCurrent.initial_yield,
            targetIrr: bpCurrent.target_irr,
            previousCount: previousCount ?? 0,
          }
        : null,
      alerts,
      source: await loadSource(supabase, summary?.import_id ?? null),
    };
  });

export const getImportContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportDto> => {
    const supabase = context.supabase;

    const { data: investors } = await supabase
      .from("investors")
      .select("id, code, name")
      .order("code");

    const { data: portfolios } = await supabase
      .from("portfolio_summary")
      .select("investor_id, assets_count");
    const countByInvestor = new Map(
      (portfolios ?? []).map((p) => [p.investor_id as string, Number(p.assets_count ?? 0)]),
    );

    const { data: imports } = await supabase
      .from("imports")
      .select("id, file_name, template_version, imported_at, status, notes, imported_by, investor_id")
      .order("imported_at", { ascending: false });

    const { data: profile } = await supabase
      .from("profiles")
      .select("investor_id")
      .eq("id", context.userId)
      .maybeSingle();

    const selected =
      profile?.investor_id ??
      imports?.find((i) => i.status === "valide")?.investor_id ??
      investors?.[0]?.id ??
      null;

    const { data: previews } = await supabase
      .from("asset_summary")
      .select("asset_id, name, market_value, annual_rent, ltv")
      .order("name");

    const { data: covenantRows } = await supabase
      .from("loans")
      .select("asset_id, ltv_covenant");
    const covenantByAsset = new Map(
      (covenantRows ?? []).map((row) => [row.asset_id as string, row.ltv_covenant]),
    );

    const [units, leases, tenants, loans, bp] = await Promise.all([
      supabase.from("units").select("id", { count: "exact", head: true }),
      supabase.from("leases").select("id", { count: "exact", head: true }),
      supabase.from("tenants").select("id", { count: "exact", head: true }),
      supabase.from("loans").select("id", { count: "exact", head: true }),
      supabase.from("bp_versions").select("id", { count: "exact", head: true }),
    ]);

    const latest = imports?.[0];

    return {
      investors: (investors ?? []).map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        assetsCount: countByInvestor.get(i.id) ?? 0,
      })),
      selectedInvestorId: selected,
      schemaVersion: latest?.template_version ?? null,
      schemaUpdatedAt: latest?.imported_at ?? null,
      lastImports: (imports ?? []).slice(0, 3).map((i) => ({
        id: i.id,
        fileName: i.file_name,
        templateVersion: i.template_version,
        importedAt: i.imported_at,
        status: i.status,
        notes: i.notes,
        importedBy: null,
      })),
      preview: (previews ?? []).map((p) => ({
        assetId: p.asset_id as string,
        name: p.name as string,
        marketValue: p.market_value,
        annualRent: p.annual_rent,
        ltv: p.ltv,
        ltvCovenant: covenantByAsset.get(p.asset_id as string) ?? null,
      })),
      counts: {
        assets: (previews ?? []).length,
        units: units.count ?? 0,
        leases: leases.count ?? 0,
        tenants: tenants.count ?? 0,
        loans: loans.count ?? 0,
        bpVersions: bp.count ?? 0,
      },
    };
  });
