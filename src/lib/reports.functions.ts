import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { buildDashboardAlerts, type DashboardAlert } from "./alerts";
import { storageUrlForBrowser } from "./asset-sheet";
import { AI_SYSTEM_PROMPT, latestReportPerPeriod, quarterPeriod, type ReportRow, type ReportStatus } from "./reports";
import { DOCUMENT_DOWNLOAD_TTL_SECONDS } from "./storage-ttl";
import { formatDate, formatMillions, formatYield } from "./format";

const NO_ID = "00000000-0000-0000-0000-000000000000";
const AI_MODEL = "claude-sonnet-5-5";


/** Refuse tout appel qui n'émane pas d'une administratrice active (lecture avec le jeton de l'utilisateur). */
async function assertActiveAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
  if (!data || data.role !== "admin" || data.is_active === false) throw new Error("Accès réservé à l'administratrice.");
}

const toRow = (r: any): ReportRow => ({
  id: r.id, periodLabel: r.period_label, periodEnd: r.period_end, version: r.version,
  status: r.status as ReportStatus, validatedAt: r.validated_at, sentAt: r.sent_at,
  correctionReason: r.correction_reason, replacesReportId: r.replaces_report_id, pdfPath: r.pdf_path,
});

export type PublishedReport = Pick<ReportRow, "id" | "periodLabel" | "periodEnd" | "version" | "validatedAt" | "correctionReason"> & {
  hasPdf: boolean;
  isCorrected: boolean;
};

async function assertActiveInvestor(supabase: SupabaseClient<Database>, userId: string) {
  const { data: profile, error } = await supabase.from("profiles").select("role, is_active, investor_id")
    .eq("id", userId).maybeSingle();
  if (error || profile?.role !== "investor" || profile.is_active !== true || !profile.investor_id) {
    throw new Error("Les rapports ne sont pas disponibles pour le moment.");
  }
}

export const listPublishedReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PublishedReport[]> => {
    await assertActiveInvestor(context.supabase, context.userId);
    // RLS supplies only the connected investor's rows; no investor identifier is accepted from the browser.
    const { data: rows, error } = await context.supabase.from("reports")
      .select("id, period_label, period_end, version, validated_at, correction_reason, pdf_path")
      .in("status", ["valide", "envoye"]).order("period_end", { ascending: false }).order("version", { ascending: false });
    if (error) throw new Error("Les rapports ne sont pas disponibles pour le moment.");
    return latestReportPerPeriod((rows ?? []).map((row) => ({
        id: row.id, periodLabel: row.period_label, periodEnd: row.period_end, version: row.version,
        validatedAt: row.validated_at, correctionReason: row.correction_reason,
        hasPdf: Boolean(row.pdf_path?.trim()), isCorrected: row.version > 1,
      })));
  });

export const getPublishedReportDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((reportId: string) => {
    if (typeof reportId !== "string" || !reportId.trim()) throw new Error("Ce rapport n'est pas disponible.");
    return reportId;
  })
  .handler(async ({ context, data }) => {
    await assertActiveInvestor(context.supabase, context.userId);
    // Re-read through RLS on every click, including publication state, before minting a private link.
    const { data: report, error } = await context.supabase.from("reports").select("pdf_path")
      .eq("id", data).in("status", ["valide", "envoye"]).maybeSingle();
    if (error || !report) throw new Error("Ce rapport n'est pas disponible.");
    if (!report.pdf_path?.trim()) throw new Error("PDF bientôt disponible");
    const { data: signed, error: signingError } = await context.supabase.storage.from("reports")
      .createSignedUrl(report.pdf_path, DOCUMENT_DOWNLOAD_TTL_SECONDS, { download: true });
    if (signingError || !signed?.signedUrl) throw new Error("Ce rapport n'est pas disponible.");
    return { url: storageUrlForBrowser(signed.signedUrl, process.env["SUPABASE_URL"], import.meta.env["VITE_SUPABASE_URL"]) };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { investorId?: string | null } | undefined) => ({ investorId: input?.investorId ?? null }))
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const { data: investors } = await context.supabase.from("investors").select("id, name").order("name");
    const investorId = data.investorId ?? investors?.[0]?.id ?? null;
    const { data: rows, error } = await context.supabase.from("reports").select("*")
      .eq("investor_id", investorId ?? NO_ID).order("period_end", { ascending: false });
    if (error) throw new Error("Les rapports ne sont pas disponibles pour le moment.");
    return { investors: investors ?? [], investorId, reports: (rows ?? []).map(toRow) };
  });

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { investorId: string; quarter: number; year: number }) => input)
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const { periodLabel, periodEnd } = quarterPeriod(data.quarter, data.year);
    const { data: existing } = await context.supabase.from("reports").select("id, version, status")
      .eq("investor_id", data.investorId).eq("period_label", periodLabel).order("version", { ascending: false });
    if (existing?.some((r) => r.status !== "brouillon")) throw new Error("Un rapport validé existe déjà pour ce trimestre : corrigez-le.");
    if (existing?.[0]) return { id: existing[0].id };
    const { data: created, error } = await context.supabase.from("reports")
      .insert({ investor_id: data.investorId, period_label: periodLabel, period_end: periodEnd, status: "brouillon", version: 1 })
      .select("id").single();
    if (error || !created) throw new Error("Le rapport n'a pas pu être créé.");
    return { id: created.id };
  });

export const correctReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; reason: string }) => {
    if (!input.reason?.trim()) throw new Error("Le motif de la correction est obligatoire.");
    return input;
  })
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const { data: base } = await context.supabase.from("reports").select("*").eq("id", data.reportId).maybeSingle();
    if (!base || base.status === "brouillon") throw new Error("Seul un rapport validé ou envoyé peut être corrigé.");
    const { data: top } = await context.supabase.from("reports").select("version")
      .eq("investor_id", base.investor_id).eq("period_label", base.period_label).order("version", { ascending: false }).limit(1);
    const { data: created, error } = await context.supabase.from("reports").insert({
      investor_id: base.investor_id, period_label: base.period_label, period_end: base.period_end,
      version: (top?.[0]?.version ?? base.version) + 1, replaces_report_id: base.id,
      correction_reason: data.reason.trim(), status: "brouillon",
    }).select("id").single();
    if (error || !created) throw new Error("La correction n'a pas pu être créée.");
    return { id: created.id };
  });

export type ReportAsset = {
  assetId: string; name: string; city: string | null;
  marketValue: number | null; annualRent: number | null; occupancyRate: number | null; ltv: number | null;
  loans: { lender: string; outstanding: number | null; maturityDate: string | null }[];
  leaseEvents: { tenantName: string; endDate: string | null; breakDate: string | null }[];
  bp: { versionLabel: string; initialYield: number | null; targetIrr: number | null } | null;
};

export type ReportContent = {
  report: ReportRow & { commentary: string | null; investorId: string };
  investorName: string;
  portfolio: { totalValue: number | null; totalAnnualRent: number | null; occupancyRate: number | null; portfolioLtv: number | null; latestDataDate: string | null } | null;
  assets: ReportAsset[];
  alerts: DashboardAlert[];
  sources: { fileName: string; templateVersion: string; importedAt: string }[];
};

async function loadContent(supabase: any, reportId: string): Promise<ReportContent> {
  const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) throw new Error("Ce rapport n'est pas disponible.");
  const investorId = report.investor_id as string;
  const [{ data: investor }, { data: portfolio }, { data: summaries }, { data: exited }] = await Promise.all([
    supabase.from("investors").select("name").eq("id", investorId).maybeSingle(),
    supabase.from("portfolio_summary").select("total_value, total_annual_rent, occupancy_rate, portfolio_ltv, latest_data_date").eq("investor_id", investorId).maybeSingle(),
    supabase.from("asset_summary").select("asset_id, name, city, market_value, annual_rent, occupancy_rate, ltv, import_id, status").eq("investor_id", investorId).order("name"),
    supabase.from("assets").select("id").eq("investor_id", investorId).eq("status", "sorti"),
  ]);
  const exitedIds = new Set((exited ?? []).map((a: any) => a.id));
  const rows = (summaries ?? []).filter((r: any) => r.asset_id && r.import_id && r.status !== "sorti" && !exitedIds.has(r.asset_id));
  const ids = rows.length ? rows.map((r: any) => r.asset_id) : [NO_ID];
  const imps = rows.length ? rows.map((r: any) => r.import_id) : [NO_ID];
  const current = (a: string, i: string) => rows.some((r: any) => r.asset_id === a && r.import_id === i);
  const [{ data: leases }, { data: loans }, { data: units }, { data: bps }, { data: imports }] = await Promise.all([
    supabase.from("leases").select("asset_id, import_id, is_active, end_date, break_date, tenant:tenants(name)").eq("is_active", true).in("asset_id", ids).in("import_id", imps),
    supabase.from("loans").select("asset_id, import_id, lender, outstanding, maturity_date, ltv, ltv_covenant").in("asset_id", ids).in("import_id", imps).order("lender"),
    supabase.from("units").select("asset_id, label, vacant_since").not("vacant_since", "is", null).in("asset_id", ids),
    supabase.from("bp_versions").select("asset_id, import_id, version_label, initial_yield, target_irr, is_current").eq("is_current", true).in("asset_id", ids).in("import_id", imps),
    supabase.from("imports").select("id, file_name, template_version, imported_at").in("id", imps).eq("status", "valide").order("imported_at", { ascending: false }),
  ]);
  const curLeases = (leases ?? []).filter((l: any) => current(l.asset_id, l.import_id));
  const curLoans = (loans ?? []).filter((l: any) => current(l.asset_id, l.import_id));
  const alerts = buildDashboardAlerts(
    rows.map((r: any) => ({ assetId: r.asset_id, name: r.name ?? "", importId: r.import_id })),
    curLeases.map((l: any) => ({ ...l, tenant_name: l.tenant?.name ?? "" })),
    curLoans.map((l: any) => ({ ...l, ltv: l.ltv == null ? null : Number(l.ltv), ltv_covenant: l.ltv_covenant == null ? null : Number(l.ltv_covenant) })),
    units ?? [],
  );
  const today = new Date().toISOString().slice(0, 10);
  return {
    report: { ...toRow(report), commentary: report.commentary, investorId },
    investorName: investor?.name ?? "",
    portfolio: portfolio ? {
      totalValue: portfolio.total_value, totalAnnualRent: portfolio.total_annual_rent,
      occupancyRate: portfolio.occupancy_rate, portfolioLtv: portfolio.portfolio_ltv, latestDataDate: portfolio.latest_data_date,
    } : null,
    assets: rows.map((r: any) => {
      const bp = (bps ?? []).find((b: any) => b.asset_id === r.asset_id && b.import_id === r.import_id);
      // Principales échéances : baux actifs à venir, triés par date la plus proche (3 au plus).
      const events = curLeases.filter((l: any) => l.asset_id === r.asset_id)
        .map((l: any) => ({ tenantName: l.tenant?.name ?? "", endDate: l.end_date, breakDate: l.break_date,
          next: [l.break_date, l.end_date].filter((d: string | null) => d && d >= today).sort()[0] ?? null }))
        .filter((e: any) => e.next).sort((a: any, b: any) => a.next.localeCompare(b.next)).slice(0, 3)
        .map(({ next: _n, ...e }: any) => e);
      return {
        assetId: r.asset_id, name: r.name ?? "", city: r.city,
        marketValue: r.market_value, annualRent: r.annual_rent, occupancyRate: r.occupancy_rate, ltv: r.ltv,
        loans: curLoans.filter((l: any) => l.asset_id === r.asset_id).map((l: any) => ({ lender: l.lender, outstanding: l.outstanding, maturityDate: l.maturity_date })),
        leaseEvents: events,
        bp: bp ? { versionLabel: bp.version_label, initialYield: bp.initial_yield, targetIrr: bp.target_irr } : null,
      };
    }),
    alerts,
    sources: (imports ?? []).map((i: any) => ({ fileName: i.file_name, templateVersion: i.template_version, importedAt: i.imported_at })),
  };
}

/** Données envoyées à l'IA et utilisées pour le contrôle des chiffres : jamais de contacts, e-mails ni NIF.
 * Les valeurs sont déjà formatées en français, exactement comme à l'écran. */
export function aiFacts(c: ReportContent) {
  const p = c.portfolio;
  return {
    periode: c.report.periodLabel,
    fin_du_trimestre: formatDate(c.report.periodEnd),
    portefeuille: p ? {
      valeur: formatMillions(p.totalValue, 1), loyers_annuels: formatMillions(p.totalAnnualRent, 2),
      occupation: formatYield(p.occupancyRate), ltv: formatYield(p.portfolioLtv), donnees_au: formatDate(p.latestDataDate),
    } : null,
    actifs: c.assets.map((a) => ({
      nom: a.name, ville: a.city, valeur: formatMillions(a.marketValue, 1), loyer_annuel: formatMillions(a.annualRent, 2),
      occupation: formatYield(a.occupancyRate), ltv: formatYield(a.ltv),
      prets: a.loans.map((l) => ({ preteur: l.lender, encours: formatMillions(l.outstanding, 1), echeance: formatDate(l.maturityDate) })),
      echeances_baux: a.leaseEvents.map((e) => ({ locataire: e.tenantName, echeance_bail: formatDate(e.endDate), option_de_sortie: formatDate(e.breakDate) })),
      business_plan: a.bp ? { version: a.bp.versionLabel, rendement_initial: formatYield(a.bp.initialYield), tri_cible: formatYield(a.bp.targetIrr) } : null,
    })),
    alertes: c.alerts.map((al) => al.kind === "bail"
      ? { type: al.event === "sortie" ? "option de sortie" : "échéance de bail", actif: al.assetName, locataire: al.tenantName, date: formatDate(al.date) }
      : al.kind === "financement"
        ? { type: "LTV proche du covenant", actif: al.assetName, ltv: formatYield(al.ltv), covenant: formatYield(al.covenant) }
        : { type: "lot vacant", actif: al.assetName, lot: al.label, mois_de_vacance: al.months }),
  };
}

export const getReportContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((reportId: string) => reportId)
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const content = await loadContent(context.supabase, data);
    return { content, facts: aiFacts(content) };
  });

export const saveCommentary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; commentary: string }) => input)
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("reports").update({ commentary: data.commentary })
      .eq("id", data.reportId).eq("status", "brouillon");
    if (error) throw new Error("Le commentaire n'a pas pu être enregistré.");
    return { ok: true };
  });

export const generateCommentary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((reportId: string) => reportId)
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée.");
    const content = await loadContent(context.supabase, data);
    if (content.report.status !== "brouillon") throw new Error("Seul un brouillon peut être modifié.");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 2000, stream: true, system: AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Données du trimestre (JSON) :\n${JSON.stringify(aiFacts(content))}` }],
      }),
    });
    if (!res.ok || !res.body) {
      console.error("Anthropic", res.status, await res.text().catch(() => ""));
      if (res.status === 401) throw new Error("La clé Anthropic est refusée.");
      if (res.status === 429) throw new Error("Trop de demandes envoyées à l'IA : réessayez dans un instant.");
      throw new Error("Le commentaire n'a pas pu être rédigé.");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", text = "", refused = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const evt = JSON.parse(line.slice(5));
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") text += evt.delta.text;
          if (evt.type === "message_delta" && evt.delta?.stop_reason === "refusal") refused = true;
          if (evt.type === "error") throw new Error("Le commentaire n'a pas pu être rédigé.");
        } catch (e) { if (e instanceof Error && e.message.startsWith("Le commentaire")) throw e; }
      }
    }
    if (refused || !text.trim()) throw new Error("L'IA n'a pas rédigé de commentaire pour ces données.");
    const commentary = text.trim();
    await context.supabase.from("reports").update({ commentary }).eq("id", data).eq("status", "brouillon");
    return { commentary };
  });

export const validateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; pdfPath: string; validatedAt: string }) => input)
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const { data: report } = await context.supabase.from("reports").select("investor_id, replaces_report_id, status").eq("id", data.reportId).maybeSingle();
    if (!report || report.status !== "brouillon") throw new Error("Ce rapport n'est plus un brouillon.");
    if (!data.pdfPath.startsWith(`${report.investor_id}/`)) throw new Error("Chemin du PDF invalide.");
    const { error } = await context.supabase.from("reports").update({
      pdf_path: data.pdfPath, status: "valide", validated_at: data.validatedAt, validated_by: context.userId,
      ...(report.replaces_report_id ? { corrected_at: data.validatedAt } : {}),
    }).eq("id", data.reportId);
    if (error) throw new Error("Le rapport n'a pas pu être validé.");
    return { ok: true };
  });

export const markReportSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((reportId: string) => reportId)
  .handler(async ({ context, data }) => {
    await assertActiveAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("reports").update({ status: "envoye", sent_at: new Date().toISOString() })
      .eq("id", data).eq("status", "valide");
    if (error) throw new Error("Le rapport n'a pas pu être marqué comme envoyé.");
    return { ok: true };
  });
