// Contrôle à la demande : règles pures, sans écriture ni calcul financier.
import type { DashboardAlert } from "./alerts";
import { formatDate, formatMillions, formatYield } from "./format";
import { quarterPeriod } from "./reports";

/** Dernier trimestre clos à la date du jour. */
export function lastClosedQuarter(now = new Date()): { periodLabel: string; periodEnd: string } {
  const q = Math.floor(now.getMonth() / 3) + 1; // trimestre en cours
  return q === 1 ? quarterPeriod(4, now.getFullYear() - 1) : quarterPeriod(q - 1, now.getFullYear());
}

export function isDataUpToDate(asOfDate: string | null, periodEnd: string): boolean {
  return Boolean(asOfDate) && asOfDate!.slice(0, 10) >= periodEnd;
}

export type ReportState = "absent" | "brouillon" | "valide_sans_pdf" | "valide" | "envoye";
export const REPORT_STATE_LABELS: Record<ReportState, string> = {
  absent: "Absent", brouillon: "Brouillon", valide_sans_pdf: "Validé sans PDF", valide: "Validé", envoye: "Envoyé",
};

/** État du rapport du trimestre : version la plus élevée. */
export function reportState(rows: { version: number; status: string; pdf_path: string | null }[]): ReportState {
  const top = [...rows].sort((a, b) => b.version - a.version)[0];
  if (!top) return "absent";
  if (top.status === "envoye") return "envoye";
  if (top.status === "valide") return top.pdf_path ? "valide" : "valide_sans_pdf";
  return "brouillon";
}

export function alertText(a: DashboardAlert): string {
  if (a.kind === "bail") {
    return a.event === "sortie"
      ? `${a.assetName} · ${a.tenantName} : option de sortie au ${formatDate(a.date)}`
      : `${a.assetName} · ${a.tenantName} : bail à échéance le ${formatDate(a.date)}`;
  }
  if (a.kind === "financement") return `${a.assetName} : LTV ${formatYield(a.ltv)} · covenant LTV ${formatYield(a.covenant)}`;
  return `${a.assetName} · ${a.label} : vacant depuis ${a.months} mois`;
}

export type ControlInvestor = {
  investorId: string;
  investorName: string;
  totalValue: number | null;
  totalAnnualRent: number | null;
  occupancyRate: number | null;
  portfolioLtv: number | null;
  latestDataDate: string | null;
  assets: { assetId: string; name: string; asOfDate: string | null; upToDate: boolean }[];
  alerts: DashboardAlert[];
  report: ReportState;
};

export type ControlResult = { runAt: string; periodLabel: string; periodEnd: string; investors: ControlInvestor[] };

export type ControlAction = { priority: 1 | 2 | 3; text: string; investorId: string; link: boolean };

export function controlActions(r: ControlResult): ControlAction[] {
  const out: ControlAction[] = [];
  for (const inv of r.investors) {
    for (const a of inv.assets) if (!a.upToDate) out.push({ priority: 1, text: `Importer les données de ${a.name}`, investorId: inv.investorId, link: false });
  }
  for (const inv of r.investors) {
    if (inv.report === "absent") out.push({ priority: 2, text: `Générer le rapport ${r.periodLabel} de ${inv.investorName}`, investorId: inv.investorId, link: true });
    else if (inv.report === "brouillon" || inv.report === "valide_sans_pdf") out.push({ priority: 2, text: `Valider le rapport ${r.periodLabel} de ${inv.investorName}`, investorId: inv.investorId, link: true });
  }
  for (const inv of r.investors) {
    if (inv.report === "valide") out.push({ priority: 3, text: `Envoyer le rapport validé ${r.periodLabel} de ${inv.investorName}, puis le marquer « envoyé »`, investorId: inv.investorId, link: true });
  }
  return out;
}

export function formatRunAt(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)} à ${hh}:${mm}`;
}

export function controlTitle(r: ControlResult): string {
  return `Contrôle du ${formatRunAt(r.runAt)} — rapport de référence ${r.periodLabel}`;
}

export function controlFileName(r: ControlResult): string {
  const d = new Date(r.runAt);
  return `Controle_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.md`;
}

export function controlMarkdown(r: ControlResult): string {
  const L: string[] = [`# ${controlTitle(r)}`, ""];
  for (const inv of r.investors) {
    L.push(`## ${inv.investorName}`, "");
    L.push(`- Valeur : ${formatMillions(inv.totalValue, 1)}`);
    L.push(`- Loyers annuels : ${formatMillions(inv.totalAnnualRent, 2)}`);
    L.push(`- Taux d'occupation : ${formatYield(inv.occupancyRate)}`);
    L.push(`- LTV du portefeuille : ${formatYield(inv.portfolioLtv)}`);
    L.push(`- Données au : ${formatDate(inv.latestDataDate)}`, "");
    L.push("### Actifs", "");
    if (inv.assets.length === 0) L.push("Aucun actif");
    else {
      L.push("| Actif | Données | Date des données |", "|---|---|---|");
      for (const a of inv.assets) L.push(`| ${a.name} | ${a.upToDate ? "À jour" : "En retard"} | ${formatDate(a.asOfDate)} |`);
    }
    L.push("", "### Alertes", "");
    if (inv.alerts.length === 0) L.push("Aucune alerte");
    else for (const a of inv.alerts) L.push(`- ${alertText(a)}`);
    L.push("", `### Rapport ${r.periodLabel} : ${REPORT_STATE_LABELS[inv.report]}`, "");
  }
  L.push("## Actions à faire", "");
  const actions = controlActions(r);
  if (actions.length === 0) L.push("Aucune action");
  else actions.forEach((a, i) => L.push(`${i + 1}. ${a.text}`));
  return L.join("\n") + "\n";
}
