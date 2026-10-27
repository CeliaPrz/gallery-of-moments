import { describe, expect, it } from "vitest";
import { controlActions, controlFileName, isDataUpToDate, lastClosedQuarter, reportState, alertText } from "@/lib/control";

describe("contrôle à la demande", () => {
  it("trimestre de référence = dernier trimestre clos", () => {
    expect(lastClosedQuarter(new Date("2026-10-27T10:00:00"))).toEqual({ periodLabel: "T3 2026", periodEnd: "2026-09-30" });
    expect(lastClosedQuarter(new Date("2026-02-01T10:00:00"))).toEqual({ periodLabel: "T4 2025", periodEnd: "2025-12-31" });
  });
  it("données à jour si as_of_date ≥ fin du trimestre", () => {
    expect(isDataUpToDate("2026-09-30", "2026-09-30")).toBe(true);
    expect(isDataUpToDate("2026-09-29", "2026-09-30")).toBe(false);
    expect(isDataUpToDate(null, "2026-09-30")).toBe(false);
  });
  it("état du rapport : version la plus élevée", () => {
    expect(reportState([])).toBe("absent");
    expect(reportState([{ version: 1, status: "envoye", pdf_path: "x" }, { version: 2, status: "brouillon", pdf_path: null }])).toBe("brouillon");
    expect(reportState([{ version: 1, status: "valide", pdf_path: null }])).toBe("valide_sans_pdf");
  });
  it("option de sortie libellée « option de sortie au »", () => {
    expect(alertText({ kind: "bail", assetId: "a", assetName: "A", tenantName: "T", event: "sortie", date: "2027-03-01" })).toContain("option de sortie au 01/03/2027");
  });
  it("actions par ordre de priorité et nom de fichier", () => {
    const r = { runAt: "2026-10-27T09:00:00", periodLabel: "T3 2026", periodEnd: "2026-09-30", investors: [
      { investorId: "i", investorName: "FAEB", totalValue: null, totalAnnualRent: null, occupancyRate: null, portfolioLtv: null, latestDataDate: null,
        assets: [{ assetId: "a", name: "A", asOfDate: "2026-06-30", upToDate: false }], alerts: [], report: "valide" as const },
    ] };
    expect(controlActions(r).map((a) => a.priority)).toEqual([1, 3]);
    expect(controlFileName(r)).toBe("Controle_2026-10-27.md");
  });
});
