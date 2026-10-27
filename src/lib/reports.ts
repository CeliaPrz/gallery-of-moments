// Règles pures du rapport trimestriel : testables, sans import serveur.

export type ReportStatus = "brouillon" | "valide" | "envoye";

export type ReportRow = {
  id: string;
  periodLabel: string;
  periodEnd: string;
  version: number;
  status: ReportStatus;
  validatedAt: string | null;
  sentAt: string | null;
  correctionReason: string | null;
  replacesReportId: string | null;
  pdfPath: string | null;
};

/** T1..T4 + année -> libellé « T1 2026 » et dernier jour du trimestre (AAAA-MM-JJ). */
export function quarterPeriod(quarter: number, year: number): { periodLabel: string; periodEnd: string } {
  if (![1, 2, 3, 4].includes(quarter) || !Number.isInteger(year)) throw new Error("Trimestre invalide.");
  const endMonth = quarter * 3; // 3, 6, 9, 12
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    periodLabel: `T${quarter} ${year}`,
    periodEnd: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Regroupe par trimestre ; la version la plus haute est la version de référence. */
export function groupReportVersions(rows: ReportRow[]): { latest: ReportRow; older: ReportRow[] }[] {
  const byPeriod = new Map<string, ReportRow[]>();
  for (const row of rows) byPeriod.set(row.periodLabel, [...(byPeriod.get(row.periodLabel) ?? []), row]);
  return [...byPeriod.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.version - a.version);
      return { latest: sorted[0], older: sorted.slice(1) };
    })
    .sort((a, b) => b.latest.periodEnd.localeCompare(a.latest.periodEnd));
}

/** Chemin de stockage : le premier dossier est toujours l'investor_id. */
export function reportStoragePath(investorId: string, periodLabel: string, version: number, ext: "pdf" | "json"): string {
  return `${investorId}/${periodLabel}_v${version}.${ext}`;
}

/** Rapport validé ou envoyé pour ce trimestre (=> proposer une correction). */
export function validatedReportFor(rows: ReportRow[], periodLabel: string): ReportRow | null {
  const list = rows.filter((r) => r.periodLabel === periodLabel && r.status !== "brouillon");
  return list.sort((a, b) => b.version - a.version)[0] ?? null;
}

// ---- Contrôle des chiffres du commentaire ----

const SPACE_RE = /[\s\u00a0\u202f]/g;

/** Forme canonique d'un nombre écrit à la française : « 92,6 » / « 1 250 » -> « 92.6 » / « 1250 ». */
export function canonicalNumber(token: string): string {
  const cleaned = token.replace(SPACE_RE, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? cleaned : String(n);
}

/** Nombres présents dans un texte, avec leur position. */
export function extractNumbers(text: string): { raw: string; start: number; end: number }[] {
  const re = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
  const out: { raw: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(re)) out.push({ raw: m[0], start: m.index!, end: m.index! + m[0].length });
  return out;
}

/** Variantes françaises d'une valeur de la base (brute, M€ 1-2 décimales, %, 1 décimale). */
export function allowedFormsOf(value: number): string[] {
  const forms = new Set<string>();
  const add = (n: number) => forms.add(String(n));
  add(value);
  for (const d of [0, 1, 2]) add(Number(value.toFixed(d)));
  const m = value / 1_000_000;
  if (Math.abs(value) >= 100_000) for (const d of [0, 1, 2]) add(Number(m.toFixed(d)));
  return [...forms];
}

/** Ensemble des nombres autorisés à partir des données envoyées à l'IA (valeurs et dates). */
export function allowedNumberSet(facts: unknown): Set<string> {
  const set = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "number") allowedFormsOf(v).forEach((f) => set.add(f));
    else if (typeof v === "string") {
      for (const n of extractNumbers(v)) set.add(canonicalNumber(n.raw));
      const date = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (date) [date[1], date[2], date[3]].forEach((p) => set.add(String(Number(p))));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return set;
}

/** Nombres du commentaire absents des données du trimestre. */
export function unknownNumbers(text: string, allowed: Set<string>) {
  return extractNumbers(text).filter((n) => !allowed.has(canonicalNumber(n.raw)));
}

// ---- Brouillon d'e-mail ----

export function emailDraft(periodLabel: string, investorName: string): { subject: string; body: string } {
  return {
    subject: `Rapport trimestriel ${periodLabel} — ${investorName}`,
    body: [
      "Bonjour,",
      "",
      `Le rapport trimestriel ${periodLabel} est disponible dans LUR. Vous le trouverez également en pièce jointe au format PDF.`,
      "",
      "Ce document est confidentiel et réservé à son destinataire.",
      "",
      "L'équipe de gestion",
    ].join("\n"),
  };
}

export const AI_SYSTEM_PROMPT =
  "Tu es analyste en gestion d'actifs immobiliers. Rédige le commentaire de gestion trimestriel destiné à l'investisseur, en français, 150 à 250 mots, ton professionnel et factuel, en trois paragraphes : synthèse du portefeuille, faits marquants par actif, points de vigilance. Utilise UNIQUEMENT les chiffres fournis, écrits exactement comme dans les données. N'invente aucun chiffre, aucun événement, aucune prévision et ne donne aucun conseil d'investissement. Si une information manque, ne la mentionne pas.";
