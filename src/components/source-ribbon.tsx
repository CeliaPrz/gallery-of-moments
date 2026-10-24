import type { SourceRibbon } from "@/server/lur.functions";
import { formatDate } from "@/lib/format";
import { MaterialIcon } from "@/components/material-icon";

export function SourceRibbonBar({ source }: { source: SourceRibbon | null }) {
  if (!source) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-container-high/60 px-3 py-2">
      <MaterialIcon name="info" className="shrink-0 text-[16px] text-surface-tint" />
      <p className="font-audit-trail text-[11px] text-secondary">
        Source : {source.fileName} · {source.templateVersion} · importé le{" "}
        {formatDate(source.importedAt)}
      </p>
    </div>
  );
}
