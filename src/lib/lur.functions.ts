import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildDashboardAlerts, nextEventDate, type DashboardAlert } from "./alerts";
import { assembleAssetSheet, storageUrlForBrowser, type AssetSheetDto } from "./asset-sheet";
import { DOCUMENT_DOWNLOAD_TTL_SECONDS, PHOTO_TTL_SECONDS } from "./storage-ttl";
export type { AssetSheetDto, LeaseRowDto, SourceRibbon } from "./asset-sheet";


export type DashboardAssetRow = {
  assetId: string;
  name: string;
  city: string | null;
  areaSqm: number | null;
  marketValue: number | null;
  annualRent: number | null;
  occupancyRate: number | null;
  ltv: number | null;
  asOfDate: string | null;
  nextEventDate: string | null;
};

export type DashboardDto = {
  fullName: string;
  investorName: string;
  isAdmin: boolean;
  investors: { id: string; name: string }[];
  selectedInvestorId: string | null;
  hasData: boolean;
  latestDataDate: string | null;
  oldestDataDate: string | null;
  totalValue: number | null;
  totalAnnualRent: number | null;
  occupancyRate: number | null;
  portfolioLtv: number | null;
  assetsCount: number | null;
  assets: DashboardAssetRow[];
  alerts: DashboardAlert[];
  lastReport: { periodLabel: string; validatedAt: string | null; pdfPath: string | null } | null;
  lastImportAt: string | null;
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

const NO_ID = "00000000-0000-0000-0000-000000000000";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { investorId?: string | null } | undefined) => ({
    investorId: typeof input?.investorId === "string" ? input.investorId : null,
  }))
  .handler(async ({ context, data: input }): Promise<DashboardDto> => {
    const supabase = context.supabase;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, investor_id")
      .eq("id", context.userId)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";

    const { data: investorList } = await supabase.from("investors").select("id, name").order("name");

    // Investisseur : la RLS ne renvoie que son portefeuille. Administratrice : investisseur choisi.
    const investorId = isAdmin
      ? (input.investorId ?? investorList?.[0]?.id ?? null)
      : (profile?.investor_id ?? null);
    const investor = investorList?.find((row) => row.id === investorId) ?? null;

    let portfolioQuery = supabase
      .from("portfolio_summary")
      .select(
        "investor_id, assets_count, latest_data_date, oldest_data_date, total_value, total_annual_rent, occupancy_rate, portfolio_ltv",
      );
    if (investorId) portfolioQuery = portfolioQuery.eq("investor_id", investorId);
    const { data: portfolios } = await portfolioQuery;
    const portfolio = portfolios?.[0] ?? null;

    let summaryQuery = supabase
      .from("asset_summary")
      .select(
        "asset_id, name, city, lettable_area_sqm, market_value, annual_rent, occupancy_rate, ltv, as_of_date, import_id, investor_id",
      )
      .order("name");
    if (investorId) summaryQuery = summaryQuery.eq("investor_id", investorId);
    const { data: summaries } = await summaryQuery;
    const rows = (summaries ?? []).filter((r) => r.asset_id && r.import_id);

    const assetIds = rows.map((r) => r.asset_id as string);
    const importIds = rows.map((r) => r.import_id as string);
    const ids = assetIds.length ? assetIds : [NO_ID];
    const imps = importIds.length ? importIds : [NO_ID];

    const [{ data: leases }, { data: loans }, { data: units }, { data: importRows }] =
      await Promise.all([
        supabase
          .from("leases")
          .select("asset_id, import_id, is_active, end_date, break_date, tenant:tenants(name)")
          .eq("is_active", true)
          .in("asset_id", ids)
          .in("import_id", imps),
        supabase
          .from("loans")
          .select("asset_id, import_id, ltv, ltv_covenant, maturity_date")
          .in("asset_id", ids)
          .in("import_id", imps),
        supabase
          .from("units")
          .select("asset_id, label, vacant_since")
          .not("vacant_since", "is", null)
          .in("asset_id", ids),
        supabase.from("imports").select("imported_at").in("id", imps).order("imported_at", { ascending: false }).limit(1),
      ]);

    const alerts = buildDashboardAlerts(
      rows.map((r) => ({ assetId: r.asset_id as string, name: r.name ?? "", importId: r.import_id })),
      (leases ?? []).map((l: any) => ({
        asset_id: l.asset_id,
        import_id: l.import_id,
        is_active: l.is_active,
        end_date: l.end_date,
        break_date: l.break_date,
        tenant_name: l.tenant?.name ?? "",
      })),
      (loans ?? []).map((l) => ({
        asset_id: l.asset_id,
        import_id: l.import_id,
        ltv: l.ltv == null ? null : Number(l.ltv),
        ltv_covenant: l.ltv_covenant == null ? null : Number(l.ltv_covenant),
      })),
      units ?? [],
    );

    // « Prochaine échéance » : la date à venir la plus proche parmi les baux actifs
    // (fin, option de sortie) et l'échéance du prêt de l'import en vigueur.
    const isCurrentRow = (assetId: string, importId: string) =>
      rows.some((r) => r.asset_id === assetId && r.import_id === importId);
    const eventDates = new Map<string, string[]>();
    const pushDate = (assetId: string, value: string | null) => {
      if (!value) return;
      eventDates.set(assetId, [...(eventDates.get(assetId) ?? []), value]);
    };
    for (const lease of leases ?? []) {
      if (!lease.is_active || !isCurrentRow(lease.asset_id, lease.import_id)) continue;
      pushDate(lease.asset_id, lease.end_date);
      pushDate(lease.asset_id, lease.break_date);
    }
    for (const loan of loans ?? []) {
      if (!isCurrentRow(loan.asset_id, loan.import_id)) continue;
      pushDate(loan.asset_id, loan.maturity_date);
    }

    let reportQuery = supabase
      .from("reports")
      .select("period_label, validated_at, pdf_path")
      .in("status", ["valide", "envoye"])
      .order("period_end", { ascending: false })
      .limit(1);
    if (investorId) reportQuery = reportQuery.eq("investor_id", investorId);
    const { data: report } = await reportQuery.maybeSingle();

    return {
      fullName: profile?.full_name ?? "",
      investorName: investor?.name ?? "",
      isAdmin,
      investors: isAdmin ? (investorList ?? []) : [],
      selectedInvestorId: investorId,
      hasData: Boolean(portfolio) && rows.length > 0,
      latestDataDate: portfolio?.latest_data_date ?? null,
      oldestDataDate: portfolio?.oldest_data_date ?? null,
      totalValue: portfolio?.total_value ?? null,
      totalAnnualRent: portfolio?.total_annual_rent ?? null,
      occupancyRate: portfolio?.occupancy_rate ?? null,
      portfolioLtv: portfolio?.portfolio_ltv ?? null,
      assetsCount: portfolio?.assets_count ?? null,
      assets: rows.map((row) => ({
        assetId: row.asset_id as string,
        name: row.name ?? "",
        city: row.city,
        areaSqm: row.lettable_area_sqm,
        marketValue: row.market_value,
        annualRent: row.annual_rent,
        occupancyRate: row.occupancy_rate,
        ltv: row.ltv,
        asOfDate: row.as_of_date,
        nextEventDate: nextEventDate(eventDates.get(row.asset_id as string) ?? []),
      })),
      alerts,
      lastReport: report
        ? { periodLabel: report.period_label, validatedAt: report.validated_at, pdfPath: report.pdf_path }
        : null,
      lastImportAt: importRows?.[0]?.imported_at ?? null,
    };
  });

export const getAssetSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((assetId: string) => assetId)
  .handler(async ({ context, data: assetId }): Promise<AssetSheetDto> => {
    const supabase = context.supabase;
    const { data: asset, error: assetError } = await supabase.from("assets")
      .select("id, name, code, asset_type, address, city, lettable_area_sqm, acquisition_date, strategy, investor_id, units_count, parking_spaces, year_built, year_renovated, cadastral_reference, description, photo_path, postal_code, created_at, updated_at")
      .eq("id", assetId).maybeSingle();
    if (assetError || !asset) throw new Error("Cet actif n'est pas disponible.");

    const [profileResult, summaryResult, investorResult, unitResult, documentResult] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", context.userId).maybeSingle(),
      supabase.from("asset_summary").select("*").eq("asset_id", assetId).maybeSingle(),
      supabase.from("investors").select("name, code").eq("id", asset.investor_id).maybeSingle(),
      supabase.from("units").select("*").eq("asset_id", assetId).order("label"),
      supabase.from("documents").select("id, name, doc_type, uploaded_at").eq("asset_id", assetId)
        .order("uploaded_at", { ascending: false }),
    ]);
    if ([profileResult, summaryResult, investorResult, unitResult, documentResult].some((r) => r.error)) {
      throw new Error("Les données de cet actif ne sont pas disponibles pour le moment.");
    }
    const importId = summaryResult.data?.import_id ?? null;
    const importResult = importId
      ? await supabase.from("imports").select("*").eq("id", importId).eq("status", "valide").maybeSingle()
      : { data: null, error: null };
    if (importResult.error) throw new Error("Les données de cet actif ne sont pas disponibles pour le moment.");
    const hasData = Boolean(importId && importResult.data);
    // Even for admins, never read historical leases, loans, or BP versions into the sheet.
    const scopedImportId = hasData && importId ? importId : NO_ID;
    const [leaseResult, loanResult, bpResult] = hasData ? await Promise.all([
      supabase.from("leases").select("*, tenant:tenants(name)").eq("asset_id", assetId)
        .eq("import_id", scopedImportId).eq("is_active", true).order("start_date", { ascending: false, nullsFirst: false }).order("id"),
      supabase.from("loans")
        .select("id, asset_id, import_id, lender, maturity_date, ltv, ltv_covenant, icr, icr_covenant, amortization_type, interest_rate, rate_type, reference_index, outstanding")
        .eq("asset_id", assetId).eq("import_id", scopedImportId).order("lender").order("id"),
      supabase.from("bp_versions").select("*").eq("asset_id", assetId).eq("import_id", scopedImportId)
        .order("version_date", { ascending: false }).order("id"),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    if ([leaseResult, loanResult, bpResult].some((r) => r.error)) {
      throw new Error("Les données de cet actif ne sont pas disponibles pour le moment.");
    }
    const assembled = assembleAssetSheet({
      asset, summary: summaryResult.data, currentImport: importResult.data,
      units: unitResult.data ?? [], leases: leaseResult.data ?? [], loans: loanResult.data ?? [],
      bpVersions: bpResult.data ?? [],
    });
    let photoUrl: string | null = null;
    if (asset.photo_path) {
      const { data: photo } = await supabase.storage.from("asset-photos").createSignedUrl(asset.photo_path, PHOTO_TTL_SECONDS);
      if (photo?.signedUrl) photoUrl = storageUrlForBrowser(
        photo.signedUrl, process.env["SUPABASE_URL"], import.meta.env['VITE_SUPABASE_URL'],
      );
    }
    return {
      ...assembled,
      fullName: profileResult.data?.full_name ?? "", isAdmin: profileResult.data?.role === "admin",
      asset: {
        id: asset.id, name: asset.name, code: asset.code, assetType: asset.asset_type,
        address: asset.address, city: asset.city, areaSqm: asset.lettable_area_sqm,
        acquisitionDate: asset.acquisition_date, strategy: asset.strategy, unitsCount: asset.units_count,
        parkingSpaces: asset.parking_spaces, yearBuilt: asset.year_built, yearRenovated: asset.year_renovated,
        cadastralReference: asset.cadastral_reference, description: asset.description,
      },
      investor: { name: investorResult.data?.name ?? "", code: investorResult.data?.code ?? "" },
      photoUrl,
      documents: (documentResult.data ?? []).map((d) => ({ id: d.id, name: d.name, docType: d.doc_type, uploadedAt: d.uploaded_at })),
    };
  });

export const getDocumentDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assetId: string; documentId: string }) => {
    if (!input.assetId || !input.documentId) throw new Error("Ce document n'est pas disponible.");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { data: document, error } = await context.supabase.from("documents")
      .select("file_path, name").eq("id", data.documentId).eq("asset_id", data.assetId).maybeSingle();
    if (error || !document) throw new Error("Ce document n'est pas disponible.");
    const { data: signed, error: signingError } = await context.supabase.storage.from("documents")
      .createSignedUrl(document.file_path, DOCUMENT_DOWNLOAD_TTL_SECONDS, { download: document.name });
    if (signingError || !signed?.signedUrl) throw new Error("Ce document n'est pas disponible.");
    return { url: storageUrlForBrowser(signed.signedUrl, process.env["SUPABASE_URL"], import.meta.env['VITE_SUPABASE_URL']) };
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

export type SidebarAssetGroup = { investorName: string | null; assets: { id: string; name: string }[] };

export const getSidebarAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: rows, error }] = await Promise.all([
      context.supabase.from("profiles").select("role").eq("id", context.userId).maybeSingle(),
      context.supabase.from("assets").select("id, name, investor:investors(name)").order("name"),
    ]);
    if (error) throw new Error(error.message);
    const isAdmin = profile?.role === "admin";
    const list = (rows ?? []).map((r) => {
      const inv = (r as { investor?: { name: string | null } | { name: string | null }[] | null }).investor;
      const investorName = Array.isArray(inv) ? (inv[0]?.name ?? null) : (inv?.name ?? null);
      return { id: r.id as string, name: (r.name as string) ?? "", investorName };
    });
    list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (!isAdmin) {
      return { isAdmin, groups: [{ investorName: null, assets: list.map(({ id, name }) => ({ id, name })) }] as SidebarAssetGroup[] };
    }
    const map = new Map<string, SidebarAssetGroup>();
    for (const a of list) {
      const key = a.investorName ?? "";
      if (!map.has(key)) map.set(key, { investorName: a.investorName, assets: [] });
      map.get(key)!.assets.push({ id: a.id, name: a.name });
    }
    const groups = [...map.values()].sort((a, b) => (a.investorName ?? "").localeCompare(b.investorName ?? "", "fr"));
    return { isAdmin, groups };
  });
