import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  formatSqm,
  formatStrategy,
  formatYield,
} from "@/lib/format";
import { getDocumentDownload, getAssetSheet } from "@/lib/lur.functions";

const assetQueryOptions = (assetId: string) =>
  queryOptions({
    queryKey: ["asset", assetId],
    queryFn: () => getAssetSheet({ data: assetId }),
    staleTime: 30_000,
    refetchInterval: 30 * 60 * 1000,
  });

export const Route = createFileRoute("/_authenticated/actifs/$assetId")({
  validateSearch: (search: Record<string, unknown>): { onglet: TabId } => ({
    onglet: TABS.some((t) => t.id === search.onglet) ? search.onglet as TabId : "synthese",
  }),
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(assetQueryOptions(params.assetId)),
  head: () => ({
    meta: [
      { title: "Fiche actif — LUR Gestion d'actifs" },
      {
        name: "description",
        content:
          "Fiche d'un actif : synthèse, baux et locataires, financement et business plan et documents.",
      },
      { property: "og:title", content: "Fiche actif — LUR Gestion d'actifs" },
      {
        property: "og:description",
        content:
          "Fiche d'un actif : synthèse, baux et locataires, financement et business plan et documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssetSheetPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="space-y-3 p-8 font-body-md text-brick">
      <p>{error instanceof Error && error.message.includes("données")
        ? error.message : "Cet actif n'est pas disponible."}</p>
      <Button asChild variant="link" className="px-0"><Link to="/">Tableau de bord</Link></Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="space-y-3 p-8 font-body-md text-secondary">
      <p>Cet actif n'est pas disponible.</p>
      <Button asChild variant="link" className="px-0"><Link to="/">Tableau de bord</Link></Button>
    </div>
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
    <section className="p-5">
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
  const { onglet: tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const downloadDocument = useServerFn(getDocumentDownload);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const covenantNear = data.loans.some((loan) => loan.covenantNear);
  const characteristics = [
    { label: "Type", value: data.asset.assetType },
    { label: "Surface", value: formatSqm(data.asset.areaSqm) },
    { label: "Nombre de lots", value: data.asset.unitsCount?.toLocaleString("fr-FR") },
    { label: "Places de parking", value: data.asset.parkingSpaces?.toLocaleString("fr-FR") },
    { label: "Année de construction", value: data.asset.yearBuilt?.toString() },
    { label: "Année de rénovation", value: data.asset.yearRenovated?.toString() },
    { label: "Date d'acquisition", value: data.asset.acquisitionDate ? formatDate(data.asset.acquisitionDate) : null },
    { label: "Stratégie", value: data.asset.strategy ? formatStrategy(data.asset.strategy) : null },
    { label: "Référence cadastrale", value: data.asset.cadastralReference },
    { label: "Description", value: data.asset.description },
  ].filter((item) => item.value != null && item.value.trim() !== "");

  async function handleDownload(documentId: string) {
    setDownloading(documentId);
    try {
      const { url } = await downloadDocument({ data: { assetId, documentId } });
      window.location.assign(url);
    } catch {
      toast.error("Ce document n'est pas disponible.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <LurShell
      isAdmin={data.isAdmin}
      fullName={data.fullName}
      investorName={data.investor.name}
      assetsCount={null}
      lastImportLabel={data.source ? formatDate(data.source.importedAt) : null}
    >
      <main className="mx-auto max-w-[1200px] space-y-6 p-6 tabular-nums lg:p-8">
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
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high text-primary">
            {data.photoUrl && data.photoUrl !== failedPhotoUrl ? (
              <img src={data.photoUrl} alt={data.asset.name} className="h-full w-full object-cover"
                onError={() => setFailedPhotoUrl(data.photoUrl)} />
            ) : <MaterialIcon name="apartment" className="text-[26px]" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display-md text-display-md text-on-surface">{data.asset.name}</h1>
              {data.alerts.length > 0 && (
                <span className="rounded-full bg-alert-amber/10 px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-alert-amber">
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
              {data.asset.acquisitionDate && <span>
                Acquisition <strong className="text-on-surface">{formatDate(data.asset.acquisitionDate)}</strong>
              </span>}
              {data.asset.strategy && <span>
                Stratégie <strong className="text-on-surface">{formatStrategy(data.asset.strategy)}</strong>
              </span>}
            </p>
          </div>
        </header>

        <div role="tablist" aria-label="Fiche actif" className="flex flex-wrap gap-1 border-b border-outline-variant/60">
          {TABS.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              onClick={() => navigate({ search: (prev) => ({ ...prev, onglet: item.id }) })}
              className={`h-auto rounded-none flex items-center gap-2 border-b-2 px-4 py-2.5 font-body-md text-[13px] transition-colors ${
                tab === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-secondary hover:text-on-surface"
              }`}
            >
              <MaterialIcon name={item.icon} className="text-[18px]" />
              {item.label}
            </Button>
          ))}
        </div>

        {!data.hasData && <p className="font-body-md text-secondary">Aucune donnée importée pour cet actif.</p>}

        {tab === "synthese" && (
          <div id="panel-synthese" role="tabpanel" className="space-y-6">
          {data.hasData && <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                {formatMillions(data.summary.marketValue, 1)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">
                Valeur d'expertise au {formatDate(data.summary.valuationDate)}
              </p>
              <div className="mt-3"><SourceRibbonBar source={data.source} /></div>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                  Loyers annuels
                </p>
                <MaterialIcon name="payments" className="shrink-0 text-[20px] text-surface-tint" />
              </div>
              <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">
                {formatMillions(data.summary.annualRent, 2)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">Quittancement annuel en place</p>
              <div className="mt-3"><SourceRibbonBar source={data.source} /></div>
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
                {formatPercent(data.summary.occupancyRate, 1)}
              </p>
              <p className="mt-1 font-body-sm text-secondary">
                {formatSqm(data.summary.vacantAreaSqm)} vacants
              </p>
              <div className="mt-3"><SourceRibbonBar source={data.source} /></div>
            </div>

            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                  LTV (Loan to Value)
                </p>
                {covenantNear && (
                  <span className="rounded-full bg-alert-amber/10 px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider text-alert-amber">
                    Proche covenant
                  </span>
                )}
              </div>
              <p className="mt-3 font-kpi-metric text-kpi-metric text-primary">
                {formatPercent(data.summary.ltv, 1)}
              </p>

              <div className="mt-3"><SourceRibbonBar source={data.source} /></div>
            </div>
          </section>}
          <SectionCard icon="apartment" title="Caractéristiques">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {characteristics.map((item) => <div key={item.label} className={item.label === "Description" ? "sm:col-span-2" : ""}>
                <dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">{item.label}</dt>
                <dd className="mt-1 whitespace-pre-line break-words font-body-md text-on-surface">{item.value}</dd>
              </div>)}
            </dl>
            <div className="mt-5"><SourceRibbonBar source={data.source} /></div>
          </SectionCard>
          </div>
        )}

        {tab === "baux" && data.hasData && (
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
                      "Franchise (fin)",
                      "Dépôt de garantie",
                      "Garantie bancaire (montant et échéance)",
                      "Charges refacturées",
                      "Parking",
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
                  {data.leases.map((lease) => (
                    <tr
                      key={lease.unitId}
                      className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low"
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface">
                        {lease.lot}
                      </td>
                      <td className="px-3 py-3">
                        {lease.isVacant ? (
                          <div>
                            <p className="font-table-data text-table-data text-on-surface">Vacant</p>
                            {lease.vacantMonths != null && <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-alert-amber/10 px-2 py-0.5 font-audit-trail text-[11px] text-alert-amber">
                              Vacant depuis {lease.vacantMonths} mois
                            </span>}
                          </div>
                        ) : (
                          <p className="font-table-data text-table-data text-on-surface">
                            {lease.tenantName || "—"}
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
                        {lease.isVacant ? "—" : (lease.indexation || "—")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data">{formatDate(lease.rentFreeEndDate)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data">{formatEuros(lease.securityDeposit)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data">
                        <p>{formatEuros(lease.bankGuaranteeAmount)}</p>
                        <p className="font-body-sm text-secondary">{formatDate(lease.bankGuaranteeExpiry)}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data">{formatEuros(lease.recoverableCharges)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-table-data text-table-data">{lease.parkingSpaces?.toLocaleString("fr-FR") ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5"><SourceRibbonBar source={data.source} /></div>
          </SectionCard>
        )}

        {tab === "finance" && data.hasData && (
          <div id="panel-finance" role="tabpanel" className="space-y-6">
            {data.loans.map((loan) => <section key={loan.id} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
                <MaterialIcon name="account_balance" className="text-[20px] text-surface-tint" />{loan.lender}
              </h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div><dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">Échéance</dt>
                  <dd className="mt-2 font-kpi-metric-sm text-kpi-metric-sm">{formatDate(loan.maturityDate)}</dd></div>
                <div><dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">Taux</dt>
                  <dd className="mt-2 font-kpi-metric-sm text-kpi-metric-sm">{formatYield(loan.interestRate)}</dd>
                  <dd className="mt-1 font-body-sm text-secondary">{loan.rateType || "—"}{loan.rateType && /variable/i.test(loan.rateType) && loan.referenceIndex ? ` · ${loan.referenceIndex}` : ""}</dd></div>
                <div><dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">Type d'amortissement</dt>
                  <dd className="mt-2 break-words font-body-md">{loan.amortizationType || "—"}</dd></div>
                <div><dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">ICR</dt>
                  <dd className="mt-2 font-kpi-metric-sm text-kpi-metric-sm">{formatMultiple(loan.icr)}</dd>
                  <dd className="mt-1 font-body-sm text-secondary">Covenant ICR : {formatMultiple(loan.icrCovenant)}</dd></div>
              </dl>
              <div className="mt-5 border-t border-outline-variant/40 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-body-md font-semibold">Suivi du Covenant LTV</p>
                  <p className={loan.covenantNear ? "font-table-data text-alert-amber" : "font-table-data text-on-surface"}>
                    {formatPercent(loan.ltv, 1)} <span className="text-secondary">/ Seuil max {formatPercent(loan.ltvCovenant, 1)}</span>
                  </p>
                </div>
                {loan.ltvProgress != null && <svg role="progressbar" aria-label={`LTV · ${loan.lender}`}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={loan.ltvProgress}
                  viewBox="0 0 100 8" preserveAspectRatio="none" className="mt-3 h-2 w-full overflow-hidden rounded-full">
                  <rect width="100" height="8" className="fill-current text-surface-container-high" />
                  {loan.amberZoneStart != null && <rect x={loan.amberZoneStart} width="100" height="8" className="fill-current text-alert-amber/30" />}
                  <rect width={loan.ltvProgress} height="8" className={loan.covenantNear ? "fill-current text-alert-amber" : "fill-current text-primary"} />
                </svg>}
              </div>
              <div className="mt-5"><SourceRibbonBar source={data.source} /></div>
            </section>)}
          </div>
        )}

        {tab === "business" && data.hasData && (
          <div id="panel-business" role="tabpanel">
          <SectionCard icon="trending_up" title="Business plan">
            {data.bp && <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-secondary-container">Référence active</span>
                <p className="font-body-md font-semibold">{data.bp.versionLabel} du {formatDate(data.bp.versionDate)}</p>
              </div>
              <p className="whitespace-pre-line break-words font-body-sm text-on-surface-variant">{data.bp.comment || "—"}</p>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">Rendement initial</dt>
                  <dd className="mt-2 font-kpi-metric-sm text-kpi-metric-sm">{formatYield(data.bp.initialYield)}</dd></div>
                <div><dt className="font-label-md text-[11px] uppercase tracking-wider text-secondary">TRI cible</dt>
                  <dd className="mt-2 font-kpi-metric-sm text-kpi-metric-sm">{formatYield(data.bp.targetIrr)}</dd></div>
              </dl>
              <SourceRibbonBar source={data.source} />
            </div>}
            {data.previousBpVersions.length > 0 && <div className="mt-6 border-t border-outline-variant/40 pt-5">
              <h3 className="mb-4 font-body-md font-semibold">Versions précédentes</h3>
              <ul className="divide-y divide-outline-variant/40">
                {data.previousBpVersions.map((version) => <li key={version.id} className="space-y-2 py-4">
                  <p className="font-body-md font-semibold">{version.versionLabel} · {formatDate(version.versionDate)}</p>
                  <p className="font-body-sm text-secondary">Rendement initial : {formatYield(version.initialYield)} · TRI cible : {formatYield(version.targetIrr)}</p>
                  <p className="whitespace-pre-line break-words font-body-sm">{version.comment || "—"}</p>
                  <SourceRibbonBar source={data.source} />
                </li>)}
              </ul>
            </div>}
          </SectionCard>
          </div>
        )}

        {tab === "documents" && (
          <div id="panel-documents" role="tabpanel">
          <SectionCard icon="folder_open" title="Documents">
            {data.documents.length === 0 ? <p className="font-body-sm text-secondary">Aucun document pour cet actif.</p> :
              <ul className="divide-y divide-outline-variant/40">
                {data.documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-body-md text-on-surface">{document.name}</p>
                    <p className="mt-1 font-body-sm text-secondary">{document.docType || "—"} · {formatDate(document.uploadedAt)}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={downloading != null}
                    aria-label={`Télécharger ${document.name}`} onClick={() => handleDownload(document.id)}>
                    <MaterialIcon name={downloading === document.id ? "hourglass_empty" : "download"} className="text-[18px]" />Télécharger
                  </Button>
                </li>)}
              </ul>}
          </SectionCard>
          </div>
        )}

      </main>
    </LurShell>
  );
}
