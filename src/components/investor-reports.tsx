import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { LurShell } from "@/components/lur-shell";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { getPublishedReportDownload, listPublishedReports, type PublishedReport } from "@/lib/reports.functions";

export const publishedReportsQuery = (userId: string) => queryOptions({
  queryKey: ["published-reports", userId],
  queryFn: () => listPublishedReports(),
});

function PdfDownload({ report }: { report: PublishedReport }) {
  const download = useServerFn(getPublishedReportDownload);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDownload = async () => {
    if (!report.hasPdf || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await download({ data: report.id });
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ce rapport n'est pas disponible.");
    } finally {
      setBusy(false);
    }
  };

  const button = (
    <Button type="button" variant="outline" disabled={!report.hasPdf || busy} aria-busy={busy}
      className="h-9 w-[200px] rounded-lg border-outline-variant bg-surface-container-lowest font-body-md text-[13px] text-primary shadow-none hover:bg-secondary-container"
      onClick={onDownload}>
      {busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
      Télécharger le PDF
    </Button>
  );

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      {report.hasPdf ? button : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} aria-label="PDF bientôt disponible" className="inline-flex cursor-not-allowed rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent>PDF bientôt disponible</TooltipContent>
        </Tooltip>
      )}
      {error && <p role="alert" className="max-w-[260px] break-words font-body-sm text-[13px] text-brick">{error}</p>}
    </div>
  );
}

export function InvestorReports({ userId, fullName, investorName }: { userId: string; fullName: string; investorName: string }) {
  const { data: reports } = useSuspenseQuery(publishedReportsQuery(userId));
  return (
    <LurShell isAdmin={false} fullName={fullName} investorName={investorName} assetsCount={null} lastImportLabel={null}>
      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <header>
          <h1 className="font-headline-md text-[28px] font-semibold text-on-surface">Rapports</h1>
        </header>
        <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
          {reports.length === 0 ? (
            <p className="font-body-md text-[13px] text-secondary">Aucun rapport publié pour le moment.</p>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="hidden grid-cols-[minmax(0,1fr)_80px_130px_200px] gap-4 pb-3 font-label-sm text-[11px] uppercase text-secondary md:grid" aria-hidden="true">
                <span>Trimestre</span><span>Version</span><span>Validation</span><span />
              </div>
              <ul>
                {reports.map((report) => (
                  <li key={report.id} className="grid grid-cols-1 items-center gap-3 border-t border-outline-variant/40 py-4 font-body-md text-[13px] md:grid-cols-[minmax(0,1fr)_80px_130px_200px] md:gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="font-semibold text-on-surface">{report.periodLabel}</p>
                      {report.isCorrected && <>
                        <span className="inline-flex rounded-full bg-alert-amber/15 px-2.5 py-0.5 font-label-sm text-[11px] text-alert-amber">Version corrigée</span>
                        {report.correctionReason && <p className="break-words text-secondary">{report.correctionReason}</p>}
                      </>}
                    </div>
                    <p className="tabular-nums"><span className="text-secondary md:hidden">Version : </span>v{report.version}</p>
                    <p className="tabular-nums"><span className="text-secondary md:hidden">Validation : </span>{formatDate(report.validatedAt)}</p>
                    <PdfDownload report={report} />
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          )}
        </section>
      </main>
    </LurShell>
  );
}