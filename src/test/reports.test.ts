import { describe, expect, it } from "vitest";
import { allowedNumberSet, groupReportVersions, quarterPeriod, reportStoragePath, unknownNumbers, type ReportRow } from "@/lib/reports";

const row = (p: Partial<ReportRow>): ReportRow => ({
  id: "x", periodLabel: "T1 2026", periodEnd: "2026-03-31", version: 1, status: "valide",
  validatedAt: null, sentAt: null, correctionReason: null, replacesReportId: null, pdfPath: null, ...p,
});

describe("rapport trimestriel", () => {
  it("period_end est le dernier jour du trimestre", () => {
    expect(quarterPeriod(1, 2026)).toEqual({ periodLabel: "T1 2026", periodEnd: "2026-03-31" });
    expect(quarterPeriod(2, 2026).periodEnd).toBe("2026-06-30");
    expect(quarterPeriod(4, 2025).periodEnd).toBe("2025-12-31");
  });
  it("la version la plus haute est la référence", () => {
    const g = groupReportVersions([row({ id: "a", version: 1 }), row({ id: "b", version: 3 }), row({ id: "c", version: 2 })]);
    expect(g[0]!.latest.id).toBe("b");
    expect(g[0]!.older.map((r) => r.id)).toEqual(["c", "a"]);
  });
  it("le chemin commence par l'investor_id", () => {
    expect(reportStoragePath("inv-1", "T1 2026", 2, "pdf")).toBe("inv-1/T1 2026_v2.pdf");
  });
  it("signale un chiffre absent des données", () => {
    const allowed = allowedNumberSet({ value: 92_600_000, occ: 94.5 });
    expect(unknownNumbers("Valeur 92,6 M€, occupation 94,5 %.", allowed)).toEqual([]);
    expect(unknownNumbers("Hausse de 12 %.", allowed).map((n) => n.raw)).toEqual(["12"]);
  });
});
