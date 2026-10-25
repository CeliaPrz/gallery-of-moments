import type { SourceRibbon } from "@/lib/lur.functions";
import { formatDate } from "@/lib/format";
import { MaterialIcon } from "@/components/material-icon";

export function SourceRibbonBar({ source }: { source: SourceRibbon | null }) {
  if (!source) return null;

  return (
    <div className="flex items-start gap-2">
      <MaterialIcon name="info" className="shrink-0 text-[16px] text-surface-tint" />
      <p className="min-w-0 break-words font-audit-trail text-[11px] text-secondary">
        Source : {source.fileName} · {source.templateVersion} · importé le{" "}
        {formatDate(source.importedAt)}
      </p>
    </div>
  );
}
