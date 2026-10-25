import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/material-icon";
import { LurShell } from "@/components/lur-shell";
import {
  formatDate,
  formatMillions,
  formatPercent,
  formatSqm,
} from "@/lib/format";
import type { DashboardAlert } from "@/lib/alerts";
import { getDashboard } from "@/lib/lur.functions";

const dashboardQueryOptions = (investorId: string | null) =>
  queryOptions({
    queryKey: ["dashboard", investorId],
    queryFn: () => getDashboard({ data: { investorId } }),
  });

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>): { investisseur?: string } =>
    typeof search["investisseur"] === "string" ? { investisseur: search["investisseur"] } : {},
  loaderDeps: ({ search }) => ({ investorId: search.investisseur ?? null }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(dashboardQueryOptions(deps.investorId)),
  pendingComponent: DashboardSkeleton,
  head: () => ({
    meta: [
      { title: "Tableau de bord — LUR Gestion d'actifs" },
      {
        name: "description",
        content:
          "Synthèse du portefeuille : valeur, loyers, occupation, LTV, alertes et derniers rapports.",
      },
      { property: "og:title", content: "Tableau de bord — LUR Gestion d'actifs" },
      {
        property: "og:description",
        content:
          "Synthèse du portefeuille : valeur, loyers, occupation, LTV, alertes et derniers rapports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 font-body-md text-brick">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 font-body-md text-secondary">Aucun portefeuille disponible.</div>
  ),
});

function alertIcon(kind: DashboardAlert["kind"]): string {
  if (kind === "financement") return "warning";
  if (kind === "bail") return "event_repeat";
  return "domain_disabled";
}

function alertKindLabel(kind: DashboardAlert["kind"]): string {
  if (kind === "financement") return "Financement";
  if (kind === "bail") return "Bail";
  return "Vacance";
}

function alertMessage(alert: DashboardAlert): string {
  if (alert.kind === "bail") {
    return `Bail ${alert.tenantName} (${alert.assetName}) : ${
      alert.event === "echeance" ? "échéance" : "option de sortie"
    } le ${formatDate(alert.date)}`;
  }
  if (alert.kind === "financement") {
    return `LTV ${alert.assetName} : ${formatPercent(alert.ltv, 1)} pour un covenant à ${formatPercent(alert.covenant, 1)}`;
  }
  return `Lot ${alert.label} (${alert.assetName}) vacant depuis ${alert.months} mois`;
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-surface-container-high" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-container-high" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-surface-container-high" />
        <div className="h-56 animate-pulse rounded-xl bg-surface-container-high" />
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-surface-container-high" />
    </main>
  );
}

function reportTitle(periodLabel: string): string {
  const match = periodLabel.match(/^T(\d)\s+(\d{4})$/);
  if (!match) return `Rapport ${periodLabel}`;
  const quarter = match[1];
  const suffix = quarter === "1" ? "er" : "e";
  return `Rapport du ${quarter}${suffix} trimestre ${match[2]}`;
}

function KpiCard({ label, icon, value }: { label: string; icon: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">{label}</p>
        <MaterialIcon name={icon} className="shrink-0 text-[20px] text-surface-tint" />
      </div>
      <p className="mt-3 font-kpi-metric text-kpi-metric tabular-nums text-primary">{value}</p>
      <p className="mt-2 font-audit-trail text-[11px] text-secondary">Source : imports Excel validés</p>
    </div>
  );
}

function DashboardPage() {
  const { investorId } = Route.useLoaderDeps();
  const { data } = useSuspenseQuery(dashboardQueryOptions(investorId));
  const navigate = useNavigate();
  const rentBars = data.assets.filter((a) => a.annualRent != null);
  const maxRent = Math.max(...rentBars.map((bar) => Number(bar.annualRent)), 1);

  return (
    <LurShell
      isAdmin={data.isAdmin}
      fullName={data.fullName}
      investorName={data.investorName}
      assetsCount={data.assetsCount}
      lastImportLabel={data.lastImportAt ? formatDate(data.lastImportAt) : null}
    >
      <header className="flex items-center justify-end gap-1 border-b border-outline-variant/40 bg-surface px-6 py-3">
        <button
          type="button"
          aria-label="Rechercher"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
        >
          <MaterialIcon name="search" className="text-[20px]" />
        </button>
        <button
          type="button"
          aria-label="Compte"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
        >
          <MaterialIcon name="person" className="text-[20px]" />
        </button>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display-md text-display-md text-on-surface">Tableau de bord</h1>
          {data.isAdmin && (
            <select
              aria-label="Investisseur"
              value={data.selectedInvestorId ?? ""}
              onChange={(e) =>
                navigate({ to: "/", search: e.target.value ? { investisseur: e.target.value } : {} })
              }
              className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 font-body-sm text-on-surface"
            >
              {data.investors.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name}
                </option>
              ))}
            </select>
          )}
          {data.hasData && (
            <p className="w-full font-body-sm tabular-nums text-secondary">
              Données au {formatDate(data.latestDataDate)}
              {data.oldestDataDate && data.oldestDataDate !== data.latestDataDate
                ? ` (certains actifs au ${formatDate(data.oldestDataDate)})`
                : ""}
            </p>
          )}
        </div>

        {!data.hasData ? (
          <p className="font-body-md text-secondary">Aucune donnée importée pour le moment.</p>
        ) : (
        <>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Valeur du portefeuille"
            icon="account_balance"
            value={formatMillions(data.totalValue, 1)}
          />
          <KpiCard
            label="Loyers annuels"
            icon="payments"
            value={formatMillions(data.totalAnnualRent, 2)}
          />
          <KpiCard
            label="Taux d'occupation"
            icon="domain_verification"
            value={formatPercent(data.occupancyRate, 1)}
          />
          <KpiCard
            label="LTV du portefeuille"
            icon="pie_chart"
            value={formatPercent(data.portfolioLtv, 1)}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MaterialIcon name="notifications_active" className="text-[20px] text-surface-tint" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Alertes</h2>
            </div>
            <span className="rounded-full bg-surface-container-high px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant">
              {data.alerts.length} élément{data.alerts.length > 1 ? "s" : ""}
            </span>
          </div>

          {data.alerts.length === 0 ? (
            <p className="font-body-sm text-secondary">Aucune alerte sur le portefeuille.</p>
          ) : (
            <ul className="space-y-2">
              {data.alerts.map((alert, index) => (
                <li
                  key={`${alert.kind}-${alert.assetId}-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-outline-variant/40 bg-surface p-4"
                >
                  <MaterialIcon
                    name={alertIcon(alert.kind)}
                    className="mt-0.5 shrink-0 text-[20px] text-alert-amber"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body-md text-[13px] font-semibold text-on-surface">
                        {alert.assetName}
                      </p>
                      <span className="rounded-full bg-alert-amber px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider text-on-primary">
                        {alertKindLabel(alert.kind)}
                      </span>
                    </div>
                    <p className="mt-1 font-body-sm text-[12px] text-secondary">
                      {alertMessage(alert)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MaterialIcon name="bar_chart" className="text-[20px] text-surface-tint" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Loyers annuels par actif
              </h2>
            </div>
            <p className="font-body-sm text-secondary">
              Total : {formatMillions(data.totalAnnualRent, 2)}
            </p>
          </div>

          <div className="space-y-3">
            {rentBars.map((bar) => (
              <div key={bar.assetId} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate font-body-sm text-secondary">{bar.name}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-container-high">
                  <div
                    className="h-2 rounded-full bg-forest"
                    style={{ width: `${Math.max((Number(bar.annualRent) / maxRent) * 100, 2)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-table-data text-table-data tabular-nums text-on-surface">
                  {formatMillions(bar.annualRent, 2)}
                </span>
              </div>
            ))}
          </div>
        </section>
        </div>

        <section id="actifs" className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MaterialIcon name="apartment" className="text-[20px] text-surface-tint" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Mes actifs</h2>
            </div>
            <p className="font-body-sm text-secondary">
              {data.assetsCount ?? data.assets.length} actifs
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/60">
                  {[
                    "Actif",
                    "Ville",
                    "Surface",
                    "Valeur",
                    "Loyer annuel",
                    "Occupation",
                    "LTV",
                    "Données au",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-3 py-3 font-label-md text-[11px] uppercase tracking-wider text-secondary"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assets.map((asset) => (
                  <tr
                    key={asset.assetId}
                    onClick={() => navigate({ to: "/actifs/$assetId", params: { assetId: asset.assetId } })}
                    className="cursor-pointer border-b border-outline-variant/40 tabular-nums last:border-0 hover:bg-surface-container-low"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {asset.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-body-sm text-secondary">
                      {asset.city ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatSqm(asset.areaSqm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatMillions(asset.marketValue, 1)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatMillions(asset.annualRent, 2)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatPercent(asset.occupancyRate, 1)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatPercent(asset.ltv, 1)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-body-sm text-secondary">
                      {formatDate(asset.asOfDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <MaterialIcon name="description" className="mt-0.5 text-[20px] text-surface-tint" />
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Dernier rapport
                </h2>
                <p className="mt-1 font-body-sm text-secondary">
                  {data.lastReport
                    ? `${reportTitle(data.lastReport.periodLabel)} · validé le ${formatDate(
                        data.lastReport.validatedAt,
                      )}`
                    : "Aucun rapport validé pour le moment."}
                </p>
              </div>
            </div>
            <a
              href={data.lastReport?.pdfPath ?? undefined}
              aria-disabled={!data.lastReport?.pdfPath}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-label-md text-[12px] uppercase tracking-wider ${
                data.lastReport?.pdfPath
                  ? "bg-primary text-on-primary hover:bg-primary-container"
                  : "cursor-not-allowed bg-surface-container-high text-outline"
              }`}
              title={data.lastReport?.pdfPath ? undefined : "PDF non disponible"}
            >
              <MaterialIcon name="download" className="text-[18px]" />
              Télécharger le PDF
            </a>
          </div>
        </section>
        </>
        )}
      </main>
    </LurShell>
  );
}
