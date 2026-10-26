import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/material-icon";
import { LurShell } from "@/components/lur-shell";
import { sidebarAssetsQueryOptions } from "@/lib/sidebar-assets";
import { SourceRibbonBar } from "@/components/source-ribbon";
import {
  formatDate,
  formatMillions,
  formatPercent,
  formatSqm,
  monthsSince,
} from "@/lib/format";
import type { AssetAlert } from "@/lib/alerts";
import { getDashboard } from "@/lib/lur.functions";

const dashboardQueryOptions = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
});

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
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
    <div role="alert" className="p-8 font-body-md text-error">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 font-body-md text-secondary">Aucun portefeuille disponible.</div>
  ),
});

function alertIcon(kind: AssetAlert["kind"]): string {
  if (kind === "covenant") return "warning";
  if (kind === "echeance") return "event_repeat";
  return "domain_disabled";
}

function alertKindLabel(kind: AssetAlert["kind"]): string {
  if (kind === "covenant") return "Covenant";
  if (kind === "echeance") return "Échéance";
  return "Vacance";
}

function alertMessage(alert: AssetAlert): string {
  if (alert.kind === "covenant") {
    return `LTV à ${formatPercent(alert.ltv)}, covenant à ${formatPercent(alert.covenant)}`;
  }
  if (alert.kind === "echeance") {
    return `bail ${alert.tenantName} à échéance le ${formatDate(alert.endDate)}`;
  }
  const months = monthsSince(alert.vacantSince);
  return `${formatSqm(alert.areaSqm)} vacants au ${alert.floorLabel}${
    months != null ? ` depuis ${months} mois` : ""
  }`;
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
      <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">{value}</p>
    </div>
  );
}

function DashboardPage() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  const sidebarAssets = useQuery(sidebarAssetsQueryOptions);
  const firstName = data.fullName.trim().split(/\s+/)[0] ?? data.fullName;
  const maxRent = Math.max(...data.rentBars.map((bar) => bar.rent), 1);

  return (
    <LurShell
      isAdmin={data.isAdmin}
      fullName={data.fullName}
      investorName={data.investorName}
      assetsCount={data.assetsCount}
      lastImportLabel={data.source ? formatDate(data.source.importedAt) : null}
      assetGroups={sidebarAssets.data?.groups ?? []}
    >
      <header className="flex items-center justify-end gap-1 border-b border-outline-variant/40 bg-surface px-6 py-3">
        <AccountMenu fullName={data.fullName} />
      </header>

      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display-md text-display-md text-on-surface">Bonjour {firstName}</h1>
          <p className="font-body-sm text-secondary">
            Données à jour au {formatDate(data.latestDataDate)}
          </p>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Valeur du portefeuille"
            icon="account_balance"
            value={formatMillions(data.totalValue)}
          />
          <KpiCard
            label="Loyers annuels"
            icon="payments"
            value={formatMillions(data.totalAnnualRent)}
          />
          <KpiCard
            label="Taux d'occupation"
            icon="domain_verification"
            value={formatPercent(data.occupancyRate)}
          />
          <KpiCard
            label="LTV du portefeuille"
            icon="pie_chart"
            value={formatPercent(data.portfolioLtv)}
          />
        </section>

        <SourceRibbonBar source={data.source} />

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
                    className="mt-0.5 shrink-0 text-[20px] text-error"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body-md text-[13px] font-semibold text-on-surface">
                        {alert.assetName}
                      </p>
                      <span className="rounded-full bg-error-container px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider text-on-error-container">
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
              Total : {formatMillions(data.totalAnnualRent)}
            </p>
          </div>

          <div className="space-y-3">
            {data.rentBars.map((bar) => (
              <div key={bar.assetId} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate font-body-sm text-secondary">{bar.name}</span>
                <div className="h-2 flex-1 rounded-full bg-surface-container-high">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max((bar.rent / maxRent) * 100, 2)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-table-data text-table-data text-on-surface">
                  {formatMillions(bar.rent)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="actifs" className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MaterialIcon name="apartment" className="text-[20px] text-surface-tint" />
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Mes actifs</h2>
            </div>
            <p className="font-body-sm text-secondary">
              {data.assetsCount} Immeubles tertiaires
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
                    "Occupation",
                    "LTV",
                    "Prochaine échéance",
                    "Dernière mise à jour",
                    "Accès",
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
                    className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {asset.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-body-sm text-secondary">
                      {asset.city}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatSqm(asset.areaSqm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatMillions(asset.marketValue)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatPercent(asset.occupancyRate)}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface"
                      title={
                        asset.ltvCovenant != null
                          ? `Seuil de covenant : ${formatPercent(asset.ltvCovenant)}`
                          : undefined
                      }
                    >
                      {formatPercent(asset.ltv)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                      {formatDate(asset.nextExpiry)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-body-sm text-secondary">
                      {formatDate(asset.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <a
                        href={`/actifs/${asset.assetId}`}
                        aria-label={`Ouvrir ${asset.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-surface-container-high"
                      >
                        <MaterialIcon name="arrow_forward" className="text-[18px]" />
                      </a>
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
      </main>
    </LurShell>
  );
}
