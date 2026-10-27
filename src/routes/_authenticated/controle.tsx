import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { LurShell } from "@/components/lur-shell";
import { controlActions, controlFileName, controlMarkdown, controlTitle, alertText, REPORT_STATE_LABELS } from "@/lib/control";
import { runControl } from "@/lib/control.functions";
import { formatDate, formatMillions, formatYield } from "@/lib/format";
import { whoami } from "@/lib/lur.functions";

const whoamiQuery = queryOptions({ queryKey: ["whoami"], queryFn: () => whoami() });

export const Route = createFileRoute("/_authenticated/controle")({
  loader: ({ context }) => context.queryClient.ensureQueryData(whoamiQuery),
  head: () => ({
    meta: [
      { title: "Contrôle — LUR Gestion d'actifs" },
      { name: "description", content: "Contrôle à la demande des données et rapports du portefeuille LUR." },
      { property: "og:title", content: "Contrôle — LUR Gestion d'actifs" },
      { property: "og:description", content: "Contrôle à la demande des données et rapports du portefeuille LUR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlPage,
});

const card = "rounded-2xl bg-surface-container-lowest p-6 shadow-sm";
const btn = "rounded-lg bg-primary px-4 py-2 font-body-md text-[13px] text-on-primary disabled:opacity-50";
const btn2 = "rounded-lg border border-outline-variant px-4 py-2 font-body-md text-[13px] text-primary hover:bg-secondary-container";
const amber = "rounded-full bg-alert-amber/15 px-2.5 py-0.5 font-label-sm text-[11px] text-alert-amber";

function ControlPage() {
  const { data: me } = useSuspenseQuery(whoamiQuery);
  const run = useServerFn(runControl);
  const m = useMutation({ mutationFn: () => run() });
  const r = m.data;

  if (me.role !== "admin") {
    return <main className="p-8"><p className="font-body-md text-[13px] text-secondary">Accès réservé à l'administratrice.</p></main>;
  }

  function download() {
    if (!r) return;
    const url = URL.createObjectURL(new Blob([controlMarkdown(r)], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = controlFileName(r); a.click();
    URL.revokeObjectURL(url);
  }

  const actions = r ? controlActions(r) : [];

  return (
    <LurShell isAdmin fullName={me.fullName} investorName={me.investor?.name ?? ""} assetsCount={null} lastImportLabel={null}>
      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-headline-md text-[28px] font-semibold text-on-surface">
            {r ? controlTitle(r) : "Contrôle"}
          </h1>
          <div className="flex gap-3">
            {r && <button type="button" className={btn2} onClick={download}>Télécharger la check-list</button>}
            <button type="button" className={btn} disabled={m.isPending} onClick={() => m.mutate()}>Lancer le contrôle</button>
          </div>
        </header>

        {m.isPending && <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-container-lowest" />)}</div>}
        {m.isError && <p role="alert" className="rounded-lg bg-brick/10 p-3 font-body-sm text-[13px] text-brick">{(m.error as Error).message}</p>}

        {r && !m.isPending && (
          <>
            {r.investors.map((inv) => (
              <section key={inv.investorId} className={`${card} space-y-5`}>
                <h2 className="font-headline-sm text-[20px] font-semibold text-on-surface">{inv.investorName}</h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    ["Valeur", formatMillions(inv.totalValue, 1)],
                    ["Loyers annuels", formatMillions(inv.totalAnnualRent, 2)],
                    ["Taux d'occupation", formatYield(inv.occupancyRate)],
                    ["LTV du portefeuille", formatYield(inv.portfolioLtv)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-surface p-4">
                      <p className="font-label-sm text-[11px] uppercase tracking-wider text-secondary">{k}</p>
                      <p className="font-headline-sm text-[22px] font-semibold tabular-nums text-on-surface">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="font-body-sm text-[12px] text-secondary">Données au {formatDate(inv.latestDataDate)}</p>

                {inv.assets.length === 0 ? <p className="font-body-md text-[13px] text-secondary">Aucun actif</p> : (
                  <table className="w-full font-body-md text-[13px]">
                    <thead className="text-left font-label-sm text-[11px] uppercase tracking-wider text-secondary">
                      <tr><th className="py-2">Actif</th><th>Données</th><th>Date des données</th></tr>
                    </thead>
                    <tbody>
                      {inv.assets.map((a) => (
                        <tr key={a.assetId} className="border-t border-outline-variant/40">
                          <td className="py-2">{a.name}</td>
                          <td>{a.upToDate ? <span className="rounded-full bg-secondary-container px-2.5 py-0.5 font-label-sm text-[11px] text-primary">À jour</span> : <span className={amber}>En retard</span>}</td>
                          <td className="tabular-nums">{formatDate(a.asOfDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div>
                  <h3 className="mb-2 font-label-sm text-[11px] uppercase tracking-wider text-secondary">Alertes</h3>
                  {inv.alerts.length === 0 ? <p className="font-body-md text-[13px] text-secondary">Aucune alerte</p> : (
                    <ul className="space-y-1">
                      {inv.alerts.map((a, i) => <li key={i} className="flex items-center gap-2 font-body-md text-[13px]"><span className="h-2 w-2 rounded-full bg-alert-amber" />{alertText(a)}</li>)}
                    </ul>
                  )}
                </div>

                <p className="font-body-md text-[13px]">Rapport {r.periodLabel} : <strong>{REPORT_STATE_LABELS[inv.report]}</strong></p>
              </section>
            ))}

            <section className={card}>
              <h2 className="mb-3 font-headline-sm text-[20px] font-semibold text-on-surface">Actions à faire</h2>
              {actions.length === 0 ? <p className="font-body-md text-[13px] text-secondary">Aucune action</p> : (
                <ol className="list-decimal space-y-1 pl-5 font-body-md text-[13px]">
                  {actions.map((a, i) => (
                    <li key={i}>{a.link ? <Link to="/rapports" className="text-primary underline">{a.text}</Link> : a.text}</li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </LurShell>
  );
}
