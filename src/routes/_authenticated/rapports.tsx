import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { LurShell } from "@/components/lur-shell";
import { InvestorReports, publishedReportsQuery } from "@/components/investor-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatMillions, formatYield } from "@/lib/format";
import { whoami } from "@/lib/lur.functions";
import {
  allowedNumberSet, emailDraft, groupReportVersions, reportStoragePath, unknownNumbers, validatedReportFor, type ReportRow,
} from "@/lib/reports";
import {
  correctReport, createReport, generateCommentary, getReportContent, listReports, markReportSent, saveCommentary, validateReport,
} from "@/lib/reports.functions";

const whoamiQuery = queryOptions({ queryKey: ["whoami"], queryFn: () => whoami() });

export const Route = createFileRoute("/_authenticated/rapports")({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(whoamiQuery);
    if (me.role === "investor") await context.queryClient.ensureQueryData(publishedReportsQuery(me.userId));
  },
  head: () => ({
    meta: [
      { title: "Rapports trimestriels — LUR Gestion d'actifs" },
      { name: "description", content: "Rapports trimestriels confidentiels du portefeuille immobilier LUR." },
      { property: "og:title", content: "Rapports trimestriels — LUR Gestion d'actifs" },
      { property: "og:description", content: "Rapports trimestriels confidentiels du portefeuille immobilier LUR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
  pendingComponent: () => <main className="mx-auto max-w-[1200px] space-y-4 p-6 lg:p-8">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</main>,
  errorComponent: () => <main className="mx-auto max-w-[1200px] p-6 lg:p-8"><p role="alert" className="rounded-lg bg-brick/10 p-3 font-body-sm text-[13px] text-brick">Les rapports ne sont pas disponibles pour le moment.</p></main>,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-tertiary-fixed text-on-tertiary-fixed" },
  valide: { label: "Validé", cls: "bg-secondary-container text-primary" },
  envoye: { label: "Envoyé", cls: "bg-primary text-on-primary" },
};

const card = "rounded-2xl bg-surface-container-lowest p-6 shadow-sm";
const btn = "rounded-lg bg-primary px-4 py-2 font-body-md text-[13px] text-on-primary disabled:opacity-50";
const btn2 = "rounded-lg border border-outline-variant px-4 py-2 font-body-md text-[13px] text-primary hover:bg-secondary-container disabled:opacity-50";
const errCls = "rounded-lg bg-[#A23B2A]/10 p-3 font-body-sm text-[13px] text-[#A23B2A]";

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS["brouillon"]!;
  return <span className={`rounded-full px-2.5 py-0.5 font-label-sm text-[11px] ${s.cls}`}>{s.label}</span>;
}

function ReportsPage() {
  const { data: me } = useSuspenseQuery(whoamiQuery);
  if (me.role === "investor") return <InvestorReports userId={me.userId} fullName={me.fullName} investorName={me.investor?.name ?? ""} />;
  return <AdminReportsPage />;
}

function AdminReportsPage() {
  const { data: me } = useSuspenseQuery(whoamiQuery);
  const qc = useQueryClient();
  const [investorId, setInvestorId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["reports", investorId], queryFn: () => listReports({ data: { investorId } }) });
  const groups = useMemo(() => groupReportVersions(list.data?.reports ?? []), [list.data]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["reports"] });

  return (
    <LurShell isAdmin fullName={me.fullName} investorName={me.investor?.name ?? ""} assetsCount={null} lastImportLabel={null}>
      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-headline-md text-[28px] font-semibold text-on-surface">Rapports</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              aria-label="Investisseur"
              className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-md text-[13px]"
              value={list.data?.investorId ?? ""}
              onChange={(e) => { setInvestorId(e.target.value); setSelected(null); }}
            >
              {(list.data?.investors ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            {list.data?.investorId && (
              <GenerateButton investorId={list.data.investorId} reports={list.data.reports}
                onDone={(id) => { refresh(); setSelected(id); }} />
            )}
          </div>
        </header>

        <section className={card}>
          {list.isPending ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            : list.isError ? <p className={errCls}>{(list.error as Error).message}</p>
            : groups.length === 0 ? <p className="font-body-md text-[13px] text-secondary">Aucun rapport pour cet investisseur.</p>
            : (
              <table className="w-full font-body-md text-[13px]">
                <thead className="text-left font-label-sm text-[11px] uppercase tracking-wider text-secondary">
                  <tr><th className="py-2">Trimestre</th><th>Version</th><th>Statut</th><th>Validation</th><th>Envoi</th><th /></tr>
                </thead>
                <tbody>
                  {groups.map(({ latest, older }) => (
                    <Fragment key={latest.id}>
                      <tr className={`cursor-pointer border-t border-outline-variant/40 font-semibold ${selected === latest.id ? "bg-secondary-container/60" : "hover:bg-secondary-container/30"}`} onClick={() => setSelected(latest.id)}>
                        <td className="py-2.5">{latest.periodLabel}</td><td>v{latest.version}</td><td><StatusPill status={latest.status} /></td>
                        <td className="tabular-nums">{formatDate(latest.validatedAt)}</td><td className="tabular-nums">{formatDate(latest.sentAt)}</td>
                        <td className="text-right">
                          {older.length > 0 && (
                            <button type="button" className="font-body-sm text-[12px] text-secondary underline"
                              onClick={(e) => { e.stopPropagation(); setExpanded((x) => ({ ...x, [latest.periodLabel]: !x[latest.periodLabel] })); }}>
                              {expanded[latest.periodLabel] ? "Masquer" : "Versions précédentes"} ({older.length})
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded[latest.periodLabel] && older.map((r) => (
                        <tr key={r.id} className="cursor-pointer text-secondary hover:bg-secondary-container/30" onClick={() => setSelected(r.id)}>
                          <td className="py-2 pl-4">{r.periodLabel}</td><td>v{r.version}</td><td><StatusPill status={r.status} /></td>
                          <td className="tabular-nums">{formatDate(r.validatedAt)}</td><td className="tabular-nums">{formatDate(r.sentAt)}</td>
                          <td className="text-right font-body-sm text-[12px]">Remplacée par la version {latest.version}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
        </section>

        {selected && <ReportDetail key={selected} reportId={selected} onChanged={refresh} onOpen={setSelected} />}
      </main>
    </LurShell>
  );
}

function GenerateButton({ investorId, reports, onDone }: { investorId: string; reports: ReportRow[]; onDone: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = validatedReportFor(reports, `T${quarter} ${year}`);

  if (!open) return <button type="button" className={btn} onClick={() => setOpen(true)}>Générer un rapport</button>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest p-2 shadow-sm">
      <select aria-label="Trimestre" className="rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
        {[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}
      </select>
      <input aria-label="Année" type="number" className="w-20 rounded-lg border border-outline-variant px-2 py-1.5 text-[13px]" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      {existing ? (
        <button type="button" className={btn} onClick={() => { setOpen(false); onDone(existing.id); }}>Corriger ce rapport</button>
      ) : (
        <button type="button" className={btn} disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { const r = await createReport({ data: { investorId, quarter, year } }); setOpen(false); onDone(r.id); }
          catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        }}>Générer</button>
      )}
      <button type="button" className={btn2} onClick={() => setOpen(false)}>Annuler</button>
      {error && <p className={errCls}>{error}</p>}
    </div>
  );
}

function HighlightedCommentary({ text, allowed }: { text: string; allowed: Set<string> }) {
  const bad = unknownNumbers(text, allowed);
  if (!bad.length) return null;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  bad.forEach((n, i) => {
    parts.push(text.slice(pos, n.start));
    parts.push(<mark key={i} className="rounded bg-[#B7791F]/25 px-0.5 text-on-surface">{n.raw}</mark>);
    pos = n.end;
  });
  parts.push(text.slice(pos));
  return (
    <div className="space-y-2 rounded-lg border border-[#B7791F]/40 bg-[#B7791F]/5 p-3">
      <p className="font-body-sm text-[12px] font-semibold text-[#B7791F]">Chiffre absent des données du trimestre : à vérifier</p>
      <p className="whitespace-pre-wrap font-body-md text-[13px]">{parts}</p>
    </div>
  );
}

function ReportDetail({ reportId, onChanged, onOpen }: { reportId: string; onChanged: () => void; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["report", reportId], queryFn: () => getReportContent({ data: reportId }) });
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const allowed = useMemo(() => (q.data ? allowedNumberSet(q.data.facts) : new Set<string>()), [q.data]);

  if (q.isPending) return <section className={card}><Skeleton className="h-40 w-full" /></section>;
  if (q.isError) return <section className={card}><p className={errCls}>{(q.error as Error).message}</p></section>;
  const c = q.data.content;
  const r = c.report;
  const text = draft ?? r.commentary ?? "";
  const isDraft = r.status === "brouillon";
  const reload = () => { qc.invalidateQueries({ queryKey: ["report", reportId] }); onChanged(); };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const validate = () => run("validate", async () => {
    const validatedAt = new Date().toISOString();
    const content = { ...c, report: { ...r, commentary: text } };
    await saveCommentary({ data: { reportId, commentary: text } });
    const { renderReportPdf } = await import("@/components/report-pdf");
    let blob: Blob;
    try { blob = await renderReportPdf(content, validatedAt); }
    catch { throw new Error("La génération du PDF a échoué : le rapport reste en brouillon."); }
    const pdfPath = reportStoragePath(r.investorId, r.periodLabel, r.version, "pdf");
    const jsonPath = reportStoragePath(r.investorId, r.periodLabel, r.version, "json");
    const up1 = await supabase.storage.from("reports").upload(pdfPath, blob, { contentType: "application/pdf", upsert: true });
    if (up1.error) throw new Error("Le PDF n'a pas pu être déposé : le rapport reste en brouillon.");
    const frozen = new Blob([JSON.stringify({ portefeuille: c.portfolio, actifs: c.assets, sources: c.sources }, null, 2)], { type: "application/json" });
    const up2 = await supabase.storage.from("reports").upload(jsonPath, frozen, { contentType: "application/json", upsert: true });
    if (up2.error) throw new Error("Les chiffres figés n'ont pas pu être déposés : le rapport reste en brouillon.");
    await validateReport({ data: { reportId, pdfPath, validatedAt } });
    setConfirm(false); setDraft(null); reload();
    toast.success("Rapport validé.");
  });

  const mail = emailDraft(r.periodLabel, c.investorName);
  const p = c.portfolio;

  return (
    <section className={`${card} space-y-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-sm text-[20px] font-semibold">Rapport {r.periodLabel} · v{r.version}</h2>
          <p className="font-body-sm text-[12px] text-secondary">{c.investorName}{r.correctionReason ? ` · Motif de la correction : ${r.correctionReason}` : ""}</p>
        </div>
        <StatusPill status={r.status} />
      </div>
      {error && <p className={errCls}>{error}</p>}

      <div>
        <h3 className="mb-2 font-headline-sm text-[15px] font-semibold">Synthèse du portefeuille</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Valeur", formatMillions(p?.totalValue, 1)], ["Loyers annuels", formatMillions(p?.totalAnnualRent, 2)],
            ["Taux d'occupation", formatYield(p?.occupancyRate)], ["LTV du portefeuille", formatYield(p?.portfolioLtv)]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-surface p-3"><p className="text-[11px] text-secondary">{l}</p><p className="font-headline-sm text-[18px] tabular-nums">{v}</p></div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-secondary">Données au {formatDate(p?.latestDataDate)}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-headline-sm text-[15px] font-semibold">Actifs</h3>
        {c.assets.length === 0 && <p className="text-[13px] text-secondary">Aucun actif en portefeuille.</p>}
        {c.assets.map((a) => (
          <div key={a.assetId} className="rounded-xl border border-outline-variant/40 p-4 text-[13px]">
            <p className="font-semibold">{a.name}{a.city ? ` · ${a.city}` : ""}</p>
            <p className="tabular-nums text-secondary">Valeur {formatMillions(a.marketValue, 1)} · Loyer {formatMillions(a.annualRent, 2)} · Occupation {formatYield(a.occupancyRate)} · LTV {formatYield(a.ltv)}</p>
            {a.loans.map((l, i) => <p key={i} className="tabular-nums">Encours {l.lender} : {formatMillions(l.outstanding, 1)}</p>)}
            {a.leaseEvents.map((e, i) => <p key={i}>Bail {e.tenantName} : fin {formatDate(e.endDate)} · option {formatDate(e.breakDate)}</p>)}
            {a.bp && <p>BP {a.bp.versionLabel} : rendement initial {formatYield(a.bp.initialYield)} · TRI cible {formatYield(a.bp.targetIrr)}</p>}
          </div>
        ))}
      </div>

      {c.alerts.length > 0 && <AlertsList alerts={c.alerts} />}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-[15px] font-semibold">Commentaire de gestion</h3>
          {isDraft && (
            <button type="button" className={btn2} disabled={!!busy} onClick={() => run("ai", async () => {
              const res = await generateCommentary({ data: reportId }); setDraft(res.commentary);
            })}>{busy === "ai" ? "Rédaction…" : text ? "Régénérer" : "Rédiger le commentaire"}</button>
          )}
        </div>
        {isDraft ? (
          <textarea aria-label="Commentaire de gestion" className="min-h-[200px] w-full rounded-lg border border-outline-variant bg-surface p-3 font-body-md text-[13px]"
            value={text} onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft != null && saveCommentary({ data: { reportId, commentary: draft } }).catch((e) => setError(e.message))} />
        ) : <p className="whitespace-pre-wrap text-[13px]">{text || "—"}</p>}
        {text && <HighlightedCommentary text={text} allowed={allowed} />}
      </div>

      <div className="space-y-1">
        {c.sources.map((s, i) => <p key={i} className="font-audit-trail text-[11px] text-secondary">Source : {s.fileName} · {s.templateVersion} · importé le {formatDate(s.importedAt)}</p>)}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/40 pt-4">
        {isDraft && !confirm && <button type="button" className={btn} disabled={!!busy} onClick={() => setConfirm(true)}>Valider le rapport</button>}
        {isDraft && confirm && (<>
          <span className="text-[13px]">Confirmer la validation ?</span>
          <button type="button" className={btn} disabled={!!busy} onClick={validate}>{busy === "validate" ? "Validation…" : "Confirmer"}</button>
          <button type="button" className={btn2} onClick={() => setConfirm(false)}>Annuler</button>
        </>)}
        {!isDraft && r.pdfPath && (
          <button type="button" className={btn2} onClick={async () => {
            const { data } = await supabase.storage.from("reports").createSignedUrl(r.pdfPath!, 60);
            if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
          }}>Ouvrir le PDF</button>
        )}
        {!isDraft && !correcting && <button type="button" className={btn2} onClick={() => setCorrecting(true)}>Corriger ce rapport</button>}
        {correcting && (<>
          <input aria-label="Motif de la correction" placeholder="Motif de la correction" className="min-w-[260px] rounded-lg border border-outline-variant px-3 py-2 text-[13px]" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className={btn} disabled={!reason.trim() || !!busy} onClick={() => run("correct", async () => {
            const res = await correctReport({ data: { reportId, reason } }); onChanged(); onOpen(res.id);
          })}>Confirmer</button>
          <button type="button" className={btn2} onClick={() => setCorrecting(false)}>Annuler</button>
        </>)}
      </div>

      {!isDraft && (
        <div className="space-y-3 rounded-xl bg-surface p-4">
          <h3 className="font-headline-sm text-[15px] font-semibold">E-mail à l'investisseur</h3>
          <p className="text-[13px]"><span className="text-secondary">Objet : </span>{mail.subject}</p>
          <p className="whitespace-pre-wrap text-[13px]">{mail.body}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn2} onClick={() => navigator.clipboard.writeText(`${mail.subject}\n\n${mail.body}`).then(() => toast.success("Copié."))}>Copier</button>
            <a className={btn2} href={`mailto:?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`}>Ouvrir dans ma messagerie</a>
            {r.status === "valide" && (
              <button type="button" className={btn} disabled={!!busy} onClick={() => run("sent", async () => { await markReportSent({ data: reportId }); reload(); })}>Marquer comme envoyé</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AlertsList({ alerts }: { alerts: Awaited<ReturnType<typeof getReportContent>>["content"]["alerts"] }) {
  const label = (a: (typeof alerts)[number]) =>
    a.kind === "bail" ? `${a.assetName} — ${a.tenantName} : ${a.event === "sortie" ? "option de sortie" : "échéance"} le ${formatDate(a.date)}`
      : a.kind === "financement" ? `${a.assetName} — LTV ${formatYield(a.ltv)} pour un covenant de ${formatYield(a.covenant)}`
      : `${a.assetName} — lot ${a.label} vacant depuis ${a.months} mois`;
  return (
    <div className="space-y-1">
      <h3 className="font-headline-sm text-[15px] font-semibold">Alertes en cours</h3>
      {alerts.map((a, i) => <p key={i} className="flex gap-2 text-[13px]"><span className="rounded-full bg-[#B7791F]/15 px-2 text-[11px] text-[#B7791F]">Alerte</span>{label(a)}</p>)}
    </div>
  );
}
