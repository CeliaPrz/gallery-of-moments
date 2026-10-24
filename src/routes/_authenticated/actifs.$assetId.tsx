import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { MaterialIcon } from "@/components/material-icon";
import { LurShell } from "@/components/lur-shell";
import { SourceRibbonBar } from "@/components/source-ribbon";
import {
  formatDate,
  formatEuros,
  formatMillions,
  formatMultiple,
  formatPercent,
  formatQuarter,
  formatSqm,
  formatStrategy,
  formatYield,
  monthsSince,
} from "@/lib/format";
import { COVENANT_PROXIMITY_RATIO, getAssetSheet } from "@/server/lur.functions";

const assetQueryOptions = (assetId: string) =>
  queryOptions({
    queryKey: ["asset", assetId],
    queryFn: () => getAssetSheet({ data: assetId }),
  });

export const Route = createFileRoute("/_authenticated/actifs.$assetId")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(assetQueryOptions(params.assetId)),
  head: () => ({
    meta: [
      { title: "Fiche actif — LUR Gestion d'actifs" },
      {
        name: "description",
        content:
          "Fiche d'un actif : synthèse, baux et locataires, financement et business plan.",
      },
      { property: "og:title", content: "Fiche actif — LUR Gestion d'actifs" },
      {
        property: "og:description",
        content:
          "Fiche d'un actif : synthèse, baux et locataires, financement et business plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssetSheetPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 font-body-md text-error">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 font-body-md text-secondary">Actif introuvable ou non autorisé.</div>
  ),
});

const TABS = [
  { id: "synthese", label: "Synthèse", icon: "summarize" },
  { id: "baux", label: "Baux et locataires", icon: "description" },
  { id: "finance", label: "Financement", icon: "account_balance" },
  { id: "business", label: "Business plan", icon: "trending_up" },
  { id: "documents", label: "Documents", icon: "folder_open" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function residualYears(maturity: string | null): string | null {
  if (!maturity) return null;
  const days = (new Date(`${maturity}T00:00:00`).getTime() - Date.now()) / 86_400_000;
  const years = days / 365.25;
  if (years <= 0) return "échue";
  return `~${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(years)} ans`;
}

function SectionCard({
  icon,
  title,
  meta,
  children,
}: {
  icon: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MaterialIcon name={icon} className="text-[20px] text-surface-tint" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
        </div>
        {meta ? <p className="font-body-sm text-secondary">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}

function AssetSheetPage() {
  const { assetId } = Route.useParams();
  const { data } = useSuspenseQuery(assetQueryOptions(assetId));
  const [tab, setTab] = useState<TabId>("synthese");

  const loan = data.loan;
  const covenantNear =
    data.summary.ltv != null &&
    loan?.ltv_covenant != null &&
    data.summary.ltv >= loan.ltv_covenant * COVENANT_PROXIMITY_RATIO;
  const icrConforme =
    loan?.icr != null && loan?.icr_covenant != null ? loan.icr > loan.icr_covenant : null;

  return (
    <LurShell
      isAdmin={false}
      fullName={data.investor.name ? data.investor.code : ""}
      investorName={data.investor.name}
      assetsCount={null}
      lastImportLabel={data.source ? formatDate(data.source.importedAt) : null}
    >
      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex items-center gap-1 font-body-sm text-secondary">
            <Link to="/" className="flex items-center gap-1 hover:text-primary">
              <MaterialIcon name="grid_view" className="text-[16px]" />
              Tableau de bord
            </Link>
            <MaterialIcon name="chevron_right" className="text-[16px]" />
            <span className="text-on-surface">{data.asset.name}</span>
          </nav>
          <div className="flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-1.5">
            <MaterialIcon name="lock" className="text-[16px] text-surface-tint" />
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant">
              Lecture seule institutionnelle · {data.investor.code}
            </span>
          </div>
        </div>

        <header className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container-high text-primary">
            <MaterialIcon name="apartment" className="text-[26px]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display-md text-display-md text-on-surface">{data.asset.name}</h1>
              {data.alerts.length > 0 && (
                <span className="rounded-full bg-error-container px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-error-container">
                  {data.alerts.length} alerte{data.alerts.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 font-body-sm text-secondary">
              <span>{data.asset.assetType}</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <MaterialIcon name="location_on" className="text-[15px]" />
                {data.asset.address}, {data.asset.city}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatSqm(data.asset.areaSqm)}</span>
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-4 font-body-sm text-secondary">
              <span>
                Acquisition <strong className="text-on-surface">{formatQuarter(data.asset.acquisitionDate)}</strong>
              </span>
              <span>
                Stratégie <strong className="text-on-surface">{formatStrategy(data.asset.strategy)}</strong>
              </span>
            </p>
          </div>
        </header>

        <div className="flex flex-wrap gap-1 border-b border-outline-variant/60">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-body-md text-[13px] transition-colors ${
                tab === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-secondary hover:text-on-surface"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[18px]" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === "synthese" && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                  Valeur vénale
                </p>
                <MaterialIcon
                  name="account_balance_wallet"
                  className="shrink-0 text-[20px] text-surface-tint"
                />
              </div>
              <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">
                {formatMillions(data.summary.marketValue)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">
                Valeur d'expertise au {formatDate(data.summary.valuationDate)}
              </p>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                  Loyers annuels
                </p>
                <MaterialIcon name="payments" className="shrink-0 text-[20px] text-surface-tint" />
              </div>
              <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">
                {formatMillions(data.summary.annualRent)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">Quittancement annuel en place</p>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                  Taux d'occupation
                </p>
                <MaterialIcon
                  name="domain_verification"
                  className="shrink-0 text-[20px] text-surface-tint"
                />
              </div>
              <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">
                {formatPercent(data.summary.occupancyRate)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">
                {formatSqm(data.summary.vacantAreaSqm)} vacants
              </p>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                  LTV (Loan to Value)
                </p>
                {covenantNear && (
                  <span className="rounded-full bg-error-container px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider text-on-error-container">
                    Proche covenant
                  </span>
                )}
              </div>
              <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">
                {formatPercent(data.summary.ltv)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">
                / max {formatPercent(loan?.ltv_covenant ?? null)}
              </p>
            </div>
          </section>
        )}

        {tab === "baux" && (
          <SectionCard
            icon="groups"
            title="Baux et locataires"
            meta={`${data.counts.activeTenants} locataires sous bail actif · ${data.counts.vacantLots} lot vacant`}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/60">
                    {[
                      "Lot",
                      "Locataire",
                      "Surface",
                      "Loyer annuel",
                      "Échéance",
                      "Option de sortie",
                      "Indexation",
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
                  {data.leases.map((lease, index) => (
                    <tr
                      key={`${lease.lot}-${index}`}
                      className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low"
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                        {lease.lot}
                      </td>
                      <td className="px-3 py-3">
                        {lease.isVacant ? (
                          <div>
                            <p className="font-table-data text-table-data text-on-surface">Vacant</p>
                            <p className="font-audit-trail text-[11px] text-secondary">
                              Vacant depuis {monthsSince(lease.vacantSince) ?? 0} mois
                            </p>
                          </div>
                        ) : (
                          <p className="font-table-data text-table-data text-on-surface">
                            {lease.tenantName}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                        {formatSqm(lease.areaSqm)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                        {lease.isVacant ? "—" : formatEuros(lease.annualRent)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                        {lease.isVacant ? "—" : formatDate(lease.endDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                        {lease.isVacant ? "—" : formatDate(lease.breakDate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-body-sm text-secondary">
                        {lease.isVacant ? "—" : (lease.indexation ?? "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {tab === "finance" && (
          <SectionCard icon="account_balance" title="Financement" meta="Prêt hypothécaire">
            {loan ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                    <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                      Prêteur
                    </p>
                    <p className="mt-2 font-kpi-metric-sm text-kpi-metric-sm text-on-surface">
                      {loan.lender}
                    </p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                    <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                      Encours de dette
                    </p>
                    <p className="mt-2 font-kpi-metric-sm text-kpi-metric-sm text-on-surface">
                      {formatMillions(loan.outstanding)}
                    </p>
                    <p className="mt-1 font-body-sm text-secondary">
                      {loan.amortizationType ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                    <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                      Échéance
                    </p>
                    <p className="mt-2 font-kpi-metric-sm text-kpi-metric-sm text-on-surface">
                      {formatDate(loan.maturityDate)}
                    </p>
                    <p className="mt-1 font-body-sm text-secondary">
                      Maturité résiduelle {residualYears(loan.maturityDate)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                    <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                      ICR
                    </p>
                    <p className="mt-2 font-kpi-metric-sm text-kpi-metric-sm text-on-surface">
                      {formatMultiple(loan.icr)}
                    </p>
                    <p className="mt-1 font-body-sm text-secondary">
                      Covenant : &gt; {formatPercent(loan.icr_covenant)} (
                      {icrConforme === null ? "—" : icrConforme ? "Conforme" : "Non conforme"})
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MaterialIcon name="warning" className="text-[18px] text-error" />
                      <p className="font-body-md text-[13px] font-semibold text-on-surface">
                        Suivi du Covenant LTV
                      </p>
                    </div>
                    <p className="font-table-data text-table-data text-on-surface">
                      {formatPercent(loan.ltv)} <span className="text-secondary">/ Seuil max {formatPercent(loan.ltv_covenant)}</span>
                    </p>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-surface-container-high">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          loan.ltv != null && loan.ltv_covenant != null
                            ? (loan.ltv / loan.ltv_covenant) * 100
                            : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 font-audit-trail text-[11px] text-secondary">
                    Niveau actuel : {formatPercent(loan.ltv)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="font-body-sm text-secondary">Aucun financement enregistré.</p>
            )}
          </SectionCard>
        )}

        {tab === "business" && (
          <SectionCard icon="trending_up" title="Business plan" meta="Approuvé IC">
            {data.bp ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-secondary-container">
                      Référence active
                    </span>
                    <p className="font-body-md text-[13px] font-semibold text-on-surface">
                      {data.bp.versionLabel} du {formatDate(data.bp.versionDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-surface p-4">
                  <MaterialIcon name="verified" className="mt-0.5 shrink-0 text-[18px] text-surface-tint" />
                  <p className="font-body-sm text-on-surface-variant">
                    {data.bp.comment ?? "Aucun commentaire enregistré pour cette version."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                    <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                      Rendement initial
                    </p>
                    <p className="mt-2 font-kpi-metric-sm text-kpi-metric-sm text-on-surface">
                      {formatYield(data.bp.initialYield)}
                    </p>
                    <p className="mt-1 font-body-sm text-secondary">Sur prix de revient global</p>
                  </div>
                  <div className="rounded-lg border border-outline-variant/40 bg-surface p-4">
                    <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                      TRI Cible 10 ans
                    </p>
                    <p className="mt-2 font-kpi-metric-sm text-kpi-metric-sm text-on-surface">
                      {formatYield(data.bp.targetIrr)}
                    </p>
                    <p className="mt-1 font-body-sm text-secondary">
                      Scénario de base conservateur
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-surface p-4">
                  <p className="font-body-md text-[13px] text-on-surface">Historique d'audit</p>
                  <p className="flex items-center gap-1 font-body-sm text-primary">
                    Voir les versions précédentes ({data.bp.previousCount})
                    <MaterialIcon name="arrow_forward" className="text-[16px]" />
                  </p>
                </div>
              </div>
            ) : (
              <p className="font-body-sm text-secondary">Aucun business plan enregistré.</p>
            )}
          </SectionCard>
        )}

        {tab === "documents" && (
          <SectionCard icon="folder_open" title="Documents">
            <p className="font-body-sm text-secondary">Aucun document rattaché à cet actif.</p>
          </SectionCard>
        )}

        <SourceRibbonBar source={data.source} />
      </main>
    </LurShell>
  );
}
