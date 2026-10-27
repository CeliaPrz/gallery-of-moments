import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getPublishedReportDownload, listPublishedReports } from "@/lib/reports.functions";
import { reportNoticeStorageKey, reportNotices } from "@/lib/reports";

function readDismissed(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]); } catch { return new Set(); }
}

export function ReportNotice() {
  const [userId, setUserId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = useServerFn(getPublishedReportDownload);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) setDismissed(readDismissed(reportNoticeStorageKey(id)));
    });
  }, []);

  const { data: reports } = useQuery({
    queryKey: ["published-reports", userId],
    queryFn: () => listPublishedReports(),
    enabled: !!userId,
  });

  if (!userId || !dismissed || !reports) return null;
  const report = reportNotices(reports, new Date(), dismissed)[0];
  if (!report) return null;

  const close = () => {
    const next = new Set(dismissed); next.add(report.id);
    localStorage.setItem(reportNoticeStorageKey(userId), JSON.stringify([...next]));
    setDismissed(next);
  };

  const onDownload = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { url } = await download({ data: report.id });
      const link = document.createElement("a");
      link.href = url; link.rel = "noopener noreferrer";
      document.body.appendChild(link); link.click(); link.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ce rapport n'est pas disponible.");
    } finally { setBusy(false); }
  };

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary-container px-5 py-3 text-on-surface">
      <p className="min-w-0 flex-1 font-body-md text-[13px] font-semibold">
        {report.version > 1 ? `Rapport ${report.periodLabel} corrigé` : `Nouveau rapport disponible : ${report.periodLabel}`}
        {report.version > 1 && report.correctionReason && <span className="font-normal"> — {report.correctionReason}</span>}
        {error && <span role="alert" className="block font-normal text-brick">{error}</span>}
      </p>
      <button type="button" onClick={onDownload} disabled={!report.hasPdf || busy}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-[12px] text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
        Télécharger
      </button>
      <button type="button" aria-label="Fermer" onClick={close} className="rounded-md p-1 hover:bg-surface-container-high">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
