// Formatage français : les valeurs viennent de la base, jamais de la maquette.

const NBSP = "\u202f"; // espace insécable fine

function number(value: number, minDigits = 0, maxDigits = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  }).format(value);
}

/** 92 600 000 -> « 92,6 M€ » (3 chiffres significatifs, comme dans la maquette). */
export function formatMillions(value: number | null | undefined, fixedDigits?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const millions = value / 1_000_000;
  const digits = fixedDigits ?? (millions >= 100 ? 0 : millions >= 10 ? 1 : 2);
  return `${number(millions, digits, digits)}${NBSP}M€`;
}

/** 81.9 -> « 82 % » (les indicateurs de la maquette sont en pourcent rond). */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${number(value, digits, digits)}${NBSP}%`;
}

/** 5.0 -> « 5,0 % » (rendements et TRI gardent une décimale). */
export function formatYield(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${number(value, 1, 1)}${NBSP}%`;
}

/** 8400 -> « 8 400 m² ». */
export function formatSqm(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${number(value, 0, 0)}${NBSP}m²`;
}

/** 420000 -> « 420 000 € ». */
export function formatEuros(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${number(value, 0, 0)}${NBSP}€`;
}

/** 2.1 -> « 2,1x ». */
export function formatMultiple(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${number(value, 1, 2)}x`;
}

/** "2027-06-30" -> « 30/06/2027 ». */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** "2026-10-14T08:00:00Z" -> « 14/10/2026 ». */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return formatDate(value);
}

/** Nombre de mois entiers écoulés depuis une date. */
export function monthsSince(value: string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const start = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months < 0 ? 0 : months;
}

/** "2021-11-15" -> « T4 2021 ». */
export function formatQuarter(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

const STRATEGY_LABELS: Record<string, string> = {
  core: "Core",
  core_plus: "Core+",
  value_add: "Value add",
  opportunistic: "Opportuniste",
};

/** "core_plus" -> « Core+ ». Un libellé inconnu est simplement capitalisé. */
export function formatStrategy(value: string | null | undefined): string {
  if (!value) return "—";
  const known = STRATEGY_LABELS[value.toLowerCase()];
  if (known) return known;
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]+/g, " ");
}

/** "bureaux" -> « Bureaux ». */
export function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Rang de tri d'un étage : « RDC à 1 » -> 0, « 4 à 5 » -> 4, « Tous » -> -1. */
export function floorRank(floor: string | null | undefined): number {
  if (!floor) return Number.MAX_SAFE_INTEGER;
  const trimmed = floor.trim().toLowerCase();
  if (trimmed.startsWith("tous")) return -1;
  if (trimmed.startsWith("rdc")) return 0;
  const match = trimmed.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}
