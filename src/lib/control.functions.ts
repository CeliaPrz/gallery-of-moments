import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildDashboardAlerts } from "./alerts";
import { isDataUpToDate, lastClosedQuarter, reportState, type ControlResult } from "./control";

const NO_ID = "00000000-0000-0000-0000-000000000000";

/** Contrôle en lecture seule : rien n'est enregistré, chaque appel recalcule. */
export const runControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ControlResult> => {
    const supabase = context.supabase;
    const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", context.userId).maybeSingle();
    if (!me || me.role !== "admin" || me.is_active === false) throw new Error("Accès réservé à l'administratrice.");

    const now = new Date();
    const { periodLabel, periodEnd } = lastClosedQuarter(now);

    const [{ data: investors }, { data: portfolios }, { data: summaries }, { data: reports }] = await Promise.all([
      supabase.from("investors").select("id, name").order("name"),
      supabase.from("portfolio_summary").select("investor_id, total_value, total_annual_rent, occupancy_rate, portfolio_ltv, latest_data_date"),
      supabase.from("asset_summary").select("asset_id, name, investor_id, as_of_date, import_id, status").eq("status", "en_portefeuille").order("name"),
      supabase.from("reports").select("investor_id, version, status, pdf_path").eq("period_label", periodLabel),
    ]);
    const rows = (summaries ?? []).filter((r) => r.asset_id);
    const withImport = rows.filter((r) => r.import_id);
    const ids = withImport.length ? withImport.map((r) => r.asset_id as string) : [NO_ID];
    const imps = withImport.length ? withImport.map((r) => r.import_id as string) : [NO_ID];

    const [{ data: leases }, { data: loans }, { data: units }] = await Promise.all([
      supabase.from("leases").select("asset_id, import_id, is_active, end_date, break_date, tenant:tenants(name)").eq("is_active", true).in("asset_id", ids).in("import_id", imps),
      supabase.from("loans").select("asset_id, import_id, ltv, ltv_covenant").in("asset_id", ids).in("import_id", imps),
      supabase.from("units").select("asset_id, label, vacant_since").not("vacant_since", "is", null).in("asset_id", ids),
    ]);

    return {
      runAt: now.toISOString(),
      periodLabel,
      periodEnd,
      investors: (investors ?? []).map((inv) => {
        const p = (portfolios ?? []).find((x) => x.investor_id === inv.id);
        const mine = rows.filter((r) => r.investor_id === inv.id);
        const mineIds = new Set(mine.map((r) => r.asset_id));
        const alerts = buildDashboardAlerts(
          mine.filter((r) => r.import_id).map((r) => ({ assetId: r.asset_id as string, name: r.name ?? "", importId: r.import_id })),
          (leases ?? []).filter((l) => mineIds.has(l.asset_id)).map((l: any) => ({
            asset_id: l.asset_id, import_id: l.import_id, is_active: l.is_active, end_date: l.end_date, break_date: l.break_date, tenant_name: l.tenant?.name ?? "",
          })),
          (loans ?? []).filter((l) => mineIds.has(l.asset_id)).map((l) => ({
            asset_id: l.asset_id, import_id: l.import_id, ltv: l.ltv == null ? null : Number(l.ltv), ltv_covenant: l.ltv_covenant == null ? null : Number(l.ltv_covenant),
          })),
          (units ?? []).filter((u) => mineIds.has(u.asset_id)),
          now,
        );
        return {
          investorId: inv.id,
          investorName: inv.name,
          totalValue: p?.total_value ?? null,
          totalAnnualRent: p?.total_annual_rent ?? null,
          occupancyRate: p?.occupancy_rate ?? null,
          portfolioLtv: p?.portfolio_ltv ?? null,
          latestDataDate: p?.latest_data_date ?? null,
          assets: mine.map((r) => ({
            assetId: r.asset_id as string, name: r.name ?? "", asOfDate: r.as_of_date, upToDate: isDataUpToDate(r.as_of_date, periodEnd),
          })),
          alerts,
          report: reportState((reports ?? []).filter((x) => x.investor_id === inv.id)),
        };
      }),
    };
  });
