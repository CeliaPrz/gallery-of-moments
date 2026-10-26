// Modèle d'import Excel v1.2 : définition des onglets, lecture des cellules et
// contrôles. Module pur (sans accès serveur) pour être testable avec vitest.
// Les contrôles comparent des chiffres ; ils n'en produisent aucun pour l'affichage.

export const TEMPLATE_VERSION = "v1.2";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type RawCell = string | number | boolean | Date | null;
export type RawSheet = { headers: RawCell[]; rows: { line: number; cells: RawCell[] }[] };
export type RawWorkbook = Record<string, RawSheet>;

type Kind = "text" | "number" | "int" | "date" | "enum" | "percent";
type Column = {
  name: string;
  field: string;
  required?: boolean;
  kind: Kind;
  options?: string[];
  nonNegative?: boolean;
};

const c = (name: string, field: string, kind: Kind, extra: Partial<Column> = {}): Column => ({
  name,
  field,
  kind,
  ...extra,
});
const req = { required: true };
const pos = { nonNegative: true };

export const SHEETS = {
  params: "Paramètres",
  assets: "Actifs",
  units: "Lots",
  tenants: "Locataires",
  leases: "Baux",
  loans: "Financement",
  bp: "Business plan",
} as const;

export const TEMPLATE: Record<string, Column[]> = {
  [SHEETS.params]: [
    c("Code investisseur", "investor_code", "text", req),
    c("Date des données", "as_of_date", "date", req),
    c("Version du modèle", "template_version", "text", req),
  ],
  [SHEETS.assets]: [
    c("Code actif", "code", "text", req),
    c("Nom", "name", "text", req),
    c("Adresse", "address", "text", req),
    c("Code postal", "postal_code", "text"),
    c("Ville", "city", "text", req),
    c("Type", "asset_type", "enum", { ...req, options: ["bureaux", "commerce", "logistique", "mixte", "autre"] }),
    c("Surface locative (m²)", "lettable_area_sqm", "number", { ...req, ...pos }),
    c("Nombre de lots", "units_count", "int"),
    c("Places de parking", "parking_spaces", "int"),
    c("Année de construction", "year_built", "int"),
    c("Année de rénovation", "year_renovated", "int"),
    c("Date d'acquisition", "acquisition_date", "date"),
    c("Stratégie", "strategy", "enum", { options: ["core", "core_plus", "value_add", "opportuniste"] }),
    c("Référence cadastrale", "cadastral_reference", "text"),
    c("Description", "description", "text"),
    c("Valeur d'expertise (€)", "market_value", "number", req),
    c("Date d'expertise", "valuation_date", "date", req),
    c("Loyer annuel (€)", "annual_rent", "number", { ...req, ...pos }),
    c("Taux d'occupation (%)", "occupancy_rate", "percent", req),
    c("Surface vacante (m²)", "vacant_area_sqm", "number", { ...req, ...pos }),
    c("LTV (%)", "ltv", "percent"),
  ],
  [SHEETS.units]: [
    c("Code actif", "asset_code", "text", req),
    c("Lot", "label", "text", req),
    c("Étage", "floor", "text"),
    c("Surface (m²)", "area_sqm", "number", { ...req, ...pos }),
    c("Usage", "use_type", "text"),
    c("Vacant depuis", "vacant_since", "date"),
  ],
  [SHEETS.tenants]: [
    c("Nom", "name", "text", req),
    c("Secteur", "sector", "text"),
    c("CIF", "tax_id", "text"),
  ],
  [SHEETS.leases]: [
    c("Code actif", "asset_code", "text", req),
    c("Lot", "unit_label", "text", req),
    c("Locataire", "tenant_name", "text", req),
    c("Début", "start_date", "date"),
    c("Échéance", "end_date", "date", req),
    c("Option de sortie", "break_date", "date"),
    c("Loyer annuel (€)", "annual_rent", "number", { ...req, ...pos }),
    c("Indexation", "indexation", "text"),
    c("Surface occupée (m²)", "area_sqm", "number", pos),
    c("Places de parking", "parking_spaces", "int"),
    c("Franchise (mois)", "rent_free_months", "int"),
    c("Fin de franchise", "rent_free_end_date", "date"),
    c("Dépôt de garantie (€)", "security_deposit", "number"),
    c("Garantie bancaire (€)", "bank_guarantee_amount", "number"),
    c("Échéance garantie bancaire", "bank_guarantee_expiry", "date"),
    c("Charges refacturées (€/an)", "recoverable_charges", "number"),
  ],
  [SHEETS.loans]: [
    c("Code actif", "asset_code", "text", req),
    c("Prêteur", "lender", "text", req),
    c("Encours (€)", "outstanding", "number", req),
    c("Échéance", "maturity_date", "date"),
    c("LTV (%)", "ltv", "percent"),
    c("Covenant LTV (%)", "ltv_covenant", "percent"),
    c("ICR", "icr", "number"),
    c("Covenant ICR", "icr_covenant", "number"),
    c("Taux (%)", "interest_rate", "percent"),
    c("Type de taux", "rate_type", "enum", { options: ["fixe", "variable"] }),
    c("Index", "reference_index", "text"),
    c("Marge (%)", "margin", "percent"),
    c("Amortissement", "amortization_type", "enum", { options: ["in_fine", "amortissable", "mixte"] }),
  ],
  [SHEETS.bp]: [
    c("Code actif", "asset_code", "text", req),
    c("Version", "version_label", "text", req),
    c("Date", "version_date", "date", req),
    c("En vigueur", "is_current", "enum", { ...req, options: ["oui", "non"] }),
    c("Rendement initial (%)", "initial_yield", "percent"),
    c("TRI cible (%)", "target_irr", "percent"),
    c("Commentaire", "comment", "text"),
  ],
};

export const PREVIEW_SHEETS = [
  SHEETS.assets,
  SHEETS.units,
  SHEETS.leases,
  SHEETS.tenants,
  SHEETS.loans,
  SHEETS.bp,
] as const;

export type Value = string | number | null;
export type Row = { line: number; values: Record<string, Value> };
export type Message = { sheet: string; line: number | null; column: string | null; text: string };

export type ImportPayload = {
  investorCode: string;
  asOfDate: string;
  templateVersion: string;
  assets: Record<string, Value>[];
  units: Record<string, Value>[];
  tenants: Record<string, Value>[];
  leases: Record<string, Value>[];
  loans: Record<string, Value>[];
  bpVersions: Record<string, Value>[];
};

export type CheckContext = {
  investorId: string;
  investorCode: string;
  /** Tous les actifs connus en base : code -> investisseur. */
  existingAssets: { code: string; investorId: string }[];
  /** Lots déjà en base pour les actifs de l'investisseur. */
  existingUnits: { assetCode: string; label: string }[];
  /** Date des données en vigueur par actif. */
  currentAsOf: { assetCode: string; asOfDate: string | null }[];
};

export type CheckResult = {
  errors: Message[];
  warnings: Message[];
  sheetsRead: number;
  preview: { sheet: string; headers: string[]; rows: { line: number; cells: Value[] }[] }[];
  payload: ImportPayload | null;
};

export const normalizeHeader = (value: RawCell): string =>
  String(value ?? "")
    .trim()
    .replace(/\s*\*+\s*$/, "")
    .trim();

export const normalizeName = (value: string): string => value.toLowerCase().replace(/\s+/g, "");

const isEmpty = (value: RawCell) =>
  value == null || (typeof value === "string" && value.trim() === "");

function isoFromParts(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateCell(value: RawCell): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return isoFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return isoFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  return null;
}

const display = (value: RawCell): string =>
  value instanceof Date ? (parseDateCell(value) ?? "") : String(value ?? "").trim();

const AGAIN = "puis déposez le fichier à nouveau.";

function at(sheet: string, line: number | null, column: string | null): string {
  return `Onglet ${sheet}${line != null ? `, ligne ${line}` : ""}${column ? `, colonne ${column}` : ""}`;
}

function msg(sheet: string, line: number | null, column: string | null, problem: string, fix: string): Message {
  return { sheet, line, column, text: `${at(sheet, line, column)} : ${problem}. ${fix}` };
}

function parseCell(
  column: Column,
  raw: RawCell,
  sheet: string,
  line: number,
  errors: Message[],
  warnings: Message[],
): Value {
  if (isEmpty(raw)) {
    if (column.required) {
      errors.push(msg(sheet, line, column.name, "valeur obligatoire manquante", `Renseignez cette cellule ${AGAIN}`));
    }
    return null;
  }
  switch (column.kind) {
    case "text":
      return display(raw);
    case "date": {
      const iso = parseDateCell(raw);
      if (!iso) {
        errors.push(
          msg(sheet, line, column.name, `la date « ${display(raw)} » n'est pas valide`, `Corrigez la date dans le fichier ${AGAIN}`),
        );
      }
      return iso;
    }
    case "enum": {
      const text = display(raw).toLowerCase();
      if (!column.options?.includes(text)) {
        errors.push(
          msg(
            sheet,
            line,
            column.name,
            `la valeur « ${display(raw)} » ne fait pas partie de la liste (${column.options?.join(", ")})`,
            `Choisissez une valeur de la liste ${AGAIN}`,
          ),
        );
        return null;
      }
      return text;
    }
    default: {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        errors.push(
          msg(
            sheet,
            line,
            column.name,
            `le nombre « ${display(raw)} » est écrit en texte`,
            `Saisissez un nombre sans espace ni texte ${AGAIN}`,
          ),
        );
        return null;
      }
      if (column.kind === "int" && !Number.isInteger(raw)) {
        errors.push(msg(sheet, line, column.name, `la valeur « ${raw} » doit être un nombre entier`, `Corrigez la valeur ${AGAIN}`));
        return null;
      }
      if (column.nonNegative && raw < 0) {
        errors.push(msg(sheet, line, column.name, `la valeur « ${raw} » est négative`, `Saisissez une valeur positive ou nulle ${AGAIN}`));
      }
      if (column.kind === "percent") {
        if (raw < 0 || raw > 100) {
          errors.push(
            msg(sheet, line, column.name, `le pourcentage « ${raw} » est hors de 0 à 100`, `Saisissez un pourcentage entre 0 et 100 ${AGAIN}`),
          );
        } else if (raw <= 1) {
          warnings.push(
            msg(
              sheet,
              line,
              column.name,
              `le pourcentage « ${raw} » est inférieur ou égal à 1, il est probablement écrit en fraction`,
              "Vérifiez qu'il s'agit bien d'un pourcentage (48 et non 0,48).",
            ),
          );
        }
      }
      return raw;
    }
  }
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;
const num = (v: Value) => (typeof v === "number" ? v : null);
const str = (v: Value) => (typeof v === "string" ? v : "");

export function checkWorkbook(workbook: RawWorkbook, context: CheckContext): CheckResult {
  const errors: Message[] = [];
  const warnings: Message[] = [];
  const rows: Record<string, Row[]> = {};
  const preview: CheckResult["preview"] = [];
  let sheetsRead = 0;

  // 1. Structure : onglets et colonnes.
  for (const [sheetName, columns] of Object.entries(TEMPLATE)) {
    const sheet = workbook[sheetName];
    if (!sheet) {
      errors.push(
        msg(sheetName, null, null, "onglet absent du fichier", `Utilisez le modèle ${TEMPLATE_VERSION} sans renommer ni supprimer d'onglet, ${AGAIN}`),
      );
      rows[sheetName] = [];
      continue;
    }
    sheetsRead += 1;
    const headers = sheet.headers.map(normalizeHeader);
    const indexByName = new Map<string, number>();
    headers.forEach((h, i) => {
      if (h) indexByName.set(h, i);
    });
    const expected = new Set(columns.map((col) => col.name));
    for (const col of columns) {
      if (!indexByName.has(col.name)) {
        errors.push(
          msg(sheetName, 1, col.name, "colonne absente ou renommée", `Rétablissez l'intitulé exact du modèle ${TEMPLATE_VERSION} ${AGAIN}`),
        );
      }
    }
    headers.forEach((h, i) => {
      if (h && !expected.has(h)) {
        errors.push(msg(sheetName, 1, `« ${h} »`, "colonne en trop", `Supprimez cette colonne ${AGAIN}`));
      }
      if (!h && sheet.rows.some((r) => !isEmpty(r.cells[i] ?? null))) {
        errors.push(msg(sheetName, 1, `n° ${i + 1}`, "colonne en trop sans intitulé", `Supprimez cette colonne ${AGAIN}`));
      }
    });

    const dataRows = sheet.rows.filter((r) => r.cells.some((cell) => !isEmpty(cell)));
    rows[sheetName] = dataRows.map((r) => {
      const values: Record<string, Value> = {};
      for (const col of columns) {
        const index = indexByName.get(col.name);
        if (index === undefined) continue;
        values[col.field] = parseCell(col, r.cells[index] ?? null, sheetName, r.line, errors, warnings);
      }
      return { line: r.line, values };
    });

    if ((PREVIEW_SHEETS as readonly string[]).includes(sheetName)) {
      preview.push({
        sheet: sheetName,
        headers: columns.map((col) => col.name),
        rows: dataRows.map((r) => ({
          line: r.line,
          cells: columns.map((col) => {
            const index = indexByName.get(col.name);
            const cell = index === undefined ? null : (r.cells[index] ?? null);
            if (cell instanceof Date) return parseDateCell(cell);
            return typeof cell === "boolean" ? String(cell) : cell;
          }),
        })),
      });
    }
  }

  const params = rows[SHEETS.params] ?? [];
  const assets = rows[SHEETS.assets] ?? [];
  const units = rows[SHEETS.units] ?? [];
  const tenants = rows[SHEETS.tenants] ?? [];
  const leases = rows[SHEETS.leases] ?? [];
  const loans = rows[SHEETS.loans] ?? [];
  const bp = rows[SHEETS.bp] ?? [];

  // 2. Paramètres.
  const param = params[0];
  if (workbook[SHEETS.params] && !param) {
    errors.push(msg(SHEETS.params, 2, null, "aucune valeur renseignée", `Complétez la ligne 2 de l'onglet ${AGAIN}`));
  }
  const investorCode = str(param?.values["investor_code"] ?? null);
  const asOfDate = str(param?.values["as_of_date"] ?? null);
  const version = str(param?.values["template_version"] ?? null);
  if (param && investorCode && investorCode !== context.investorCode) {
    errors.push(
      msg(
        SHEETS.params,
        param.line,
        "Code investisseur",
        `le code « ${investorCode} » ne correspond pas à l'investisseur choisi (${context.investorCode})`,
        `Choisissez le bon investisseur ou corrigez le code ${AGAIN}`,
      ),
    );
  }
  if (param && version && version !== TEMPLATE_VERSION) {
    errors.push(
      msg(SHEETS.params, param.line, "Version du modèle", `la version « ${version} » n'est pas ${TEMPLATE_VERSION}`, `Utilisez le modèle ${TEMPLATE_VERSION} ${AGAIN}`),
    );
  }

  // 6. Liens.
  const assetCodes = new Set<string>();
  const assetByCode = new Map<string, Row>();
  const existingByCode = new Map(context.existingAssets.map((a) => [a.code, a.investorId]));
  for (const row of assets) {
    const code = str(row.values["code"] ?? null);
    if (!code) continue;
    if (assetCodes.has(code)) {
      errors.push(msg(SHEETS.assets, row.line, "Code actif", `le code « ${code} » est en double`, `Gardez une seule ligne par actif ${AGAIN}`));
    }
    assetCodes.add(code);
    assetByCode.set(code, row);
    const owner = existingByCode.get(code);
    if (owner && owner !== context.investorId) {
      errors.push(
        msg(SHEETS.assets, row.line, "Code actif", `le code « ${code} » est déjà attribué à un autre investisseur`, `Corrigez le code actif ${AGAIN}`),
      );
    }
  }
  for (const [sheetName, list] of [
    [SHEETS.units, units],
    [SHEETS.leases, leases],
    [SHEETS.loans, loans],
    [SHEETS.bp, bp],
  ] as const) {
    for (const row of list) {
      const code = str(row.values["asset_code"] ?? null);
      if (code && !assetCodes.has(code)) {
        errors.push(
          msg(sheetName, row.line, "Code actif", `le code « ${code} » est absent de l'onglet Actifs`, `Ajoutez l'actif dans l'onglet Actifs ou corrigez le code ${AGAIN}`),
        );
      }
    }
  }

  const unitKeys = new Set<string>();
  for (const row of units) {
    const key = `${str(row.values["asset_code"] ?? null)}\u0000${str(row.values["label"] ?? null)}`;
    if (!row.values["asset_code"] || !row.values["label"]) continue;
    if (unitKeys.has(key)) {
      errors.push(
        msg(SHEETS.units, row.line, "Lot", `le lot « ${str(row.values["label"])} » est en double pour l'actif ${str(row.values["asset_code"])}`, `Gardez une seule ligne par lot ${AGAIN}`),
      );
    }
    unitKeys.add(key);
  }
  const tenantNames = new Set(tenants.map((t) => normalizeName(str(t.values["name"] ?? null))).filter(Boolean));
  const leasedUnits = new Set<string>();
  for (const row of leases) {
    const code = str(row.values["asset_code"] ?? null);
    const label = str(row.values["unit_label"] ?? null);
    const tenant = str(row.values["tenant_name"] ?? null);
    if (code && label) {
      leasedUnits.add(`${code}\u0000${label}`);
      if (assetCodes.has(code) && !unitKeys.has(`${code}\u0000${label}`)) {
        errors.push(
          msg(SHEETS.leases, row.line, "Lot", `le lot « ${label} » n'existe pas pour l'actif ${code} dans l'onglet Lots`, `Ajoutez le lot ou corrigez son intitulé ${AGAIN}`),
        );
      }
    }
    if (tenant && !tenantNames.has(normalizeName(tenant))) {
      errors.push(
        msg(SHEETS.leases, row.line, "Locataire", `le locataire « ${tenant} » n'existe pas dans l'onglet Locataires`, `Ajoutez le locataire ou corrigez son nom ${AGAIN}`),
      );
    }
  }

  // 7 et 8. Business plan en vigueur et lots par actif.
  for (const [code, row] of assetByCode) {
    const current = bp.filter((b) => b.values["asset_code"] === code && b.values["is_current"] === "oui").length;
    if (current !== 1) {
      errors.push(
        msg(
          SHEETS.bp,
          null,
          "En vigueur",
          `l'actif ${code} a ${current === 0 ? "aucune" : "plusieurs"} version « oui » en vigueur`,
          `Indiquez exactement une version « oui » par actif ${AGAIN}`,
        ),
      );
    }
    if (!units.some((u) => u.values["asset_code"] === code)) {
      errors.push(
        msg(SHEETS.assets, row.line, "Code actif", `l'actif ${code} n'a aucun lot dans l'onglet Lots`, `Ajoutez au moins un lot pour cet actif ${AGAIN}`),
      );
    }
  }

  // Avertissements de cohérence.
  for (const [code, row] of assetByCode) {
    const assetRent = num(row.values["annual_rent"] ?? null);
    const assetLeases = leases.filter((l) => l.values["asset_code"] === code);
    if (assetRent != null && assetLeases.length > 0) {
      const rents = assetLeases.map((l) => num(l.values["annual_rent"] ?? null));
      if (rents.every((r) => r != null) && !same(rents.reduce<number>((a, b) => a + (b ?? 0), 0), assetRent)) {
        warnings.push(
          msg(SHEETS.leases, null, "Loyer annuel (€)", `pour l'actif ${code}, la somme des loyers des baux est différente du loyer annuel de l'onglet Actifs (ligne ${row.line})`, "Vérifiez les loyers dans les deux onglets."),
        );
      }
    }
    const assetUnits = units.filter((u) => u.values["asset_code"] === code);
    const areas = assetUnits.map((u) => num(u.values["area_sqm"] ?? null));
    const lettable = num(row.values["lettable_area_sqm"] ?? null);
    if (lettable != null && assetUnits.length > 0 && areas.every((a) => a != null)) {
      if (!same(areas.reduce<number>((a, b) => a + (b ?? 0), 0), lettable)) {
        warnings.push(
          msg(SHEETS.units, null, "Surface (m²)", `pour l'actif ${code}, la somme des surfaces des lots est différente de la surface locative (onglet Actifs, ligne ${row.line})`, "Vérifiez les surfaces dans les deux onglets."),
        );
      }
      const vacantArea = num(row.values["vacant_area_sqm"] ?? null);
      const vacantSum = assetUnits
        .filter((u) => u.values["vacant_since"] != null)
        .reduce<number>((a, u) => a + (num(u.values["area_sqm"] ?? null) ?? 0), 0);
      if (vacantArea != null && !same(vacantSum, vacantArea)) {
        warnings.push(
          msg(SHEETS.units, null, "Vacant depuis", `pour l'actif ${code}, la surface des lots vacants est différente de la surface vacante (onglet Actifs, ligne ${row.line})`, "Vérifiez les lots vacants et la surface vacante."),
        );
      }
    }
  }
  for (const row of units) {
    const key = `${str(row.values["asset_code"] ?? null)}\u0000${str(row.values["label"] ?? null)}`;
    if (row.values["label"] && !leasedUnits.has(key) && row.values["vacant_since"] == null) {
      warnings.push(
        msg(SHEETS.units, row.line, "Vacant depuis", `le lot « ${str(row.values["label"])} » n'a ni bail ni date « Vacant depuis »`, "Ajoutez un bail ou la date de vacance."),
      );
    }
  }
  for (const row of loans) {
    const ltv = num(row.values["ltv"] ?? null);
    const covenant = num(row.values["ltv_covenant"] ?? null);
    if (ltv != null && covenant != null && ltv >= covenant - 5) {
      warnings.push(
        msg(SHEETS.loans, row.line, "LTV (%)", `la LTV (${ltv}) est supérieure ou égale au covenant moins 5 points (covenant ${covenant})`, "Vérifiez le financement de cet actif."),
      );
    }
  }
  if (asOfDate) {
    for (const current of context.currentAsOf) {
      if (assetCodes.has(current.assetCode) && current.asOfDate && asOfDate < current.asOfDate) {
        warnings.push(
          msg(SHEETS.params, param?.line ?? 2, "Date des données", `la date des données est plus ancienne que les données en vigueur de l'actif ${current.assetCode}`, "Vérifiez qu'il s'agit bien du fichier le plus récent."),
        );
      }
    }
  }
  const fileUnits = new Set(units.map((u) => `${str(u.values["asset_code"] ?? null)}\u0000${str(u.values["label"] ?? null)}`));
  for (const unit of context.existingUnits) {
    if (assetCodes.has(unit.assetCode) && !fileUnits.has(`${unit.assetCode}\u0000${unit.label}`)) {
      warnings.push(
        msg(SHEETS.units, null, "Lot", `le lot « ${unit.label} » de l'actif ${unit.assetCode} existe dans l'application mais est absent du fichier`, "Il sera conservé ; vérifiez s'il doit figurer dans le fichier."),
      );
    }
  }

  const values = (list: Row[]) => list.map((r) => r.values);
  const payload: ImportPayload | null =
    errors.length === 0
      ? {
          investorCode,
          asOfDate,
          templateVersion: version,
          assets: values(assets),
          units: values(units),
          tenants: values(tenants),
          leases: values(leases),
          loans: values(loans),
          bpVersions: values(bp),
        }
      : null;

  return { errors, warnings, sheetsRead, preview, payload };
}

/** Imports valides précédents dont tous les actifs figurent dans le nouveau fichier. */
export function importsToReplace(
  previous: { id: string; assetIds: string[] }[],
  newAssetIds: Iterable<string>,
): string[] {
  const covered = new Set(newAssetIds);
  return previous
    .filter((p) => p.assetIds.length > 0 && p.assetIds.every((id) => covered.has(id)))
    .map((p) => p.id);
}

/** Lecture d'un classeur dans le navigateur avec exceljs (chargé à la demande). */
export async function readWorkbook(file: File): Promise<RawWorkbook> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const result: RawWorkbook = {};
  workbook.eachSheet((sheet) => {
    const toCell = (value: unknown): RawCell => {
      if (value == null) return null;
      if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      if (typeof value === "object") {
        const v = value as { richText?: { text: string }[]; result?: unknown; text?: string; error?: string };
        if (v.richText) return v.richText.map((t) => t.text).join("");
        if ("result" in v) return toCell(v.result);
        if (typeof v.text === "string") return v.text;
        if (v.error) return v.error;
      }
      return String(value);
    };
    const width = sheet.columnCount;
    const readRow = (index: number): RawCell[] => {
      const row = sheet.getRow(index);
      return Array.from({ length: width }, (_, i) => toCell(row.getCell(i + 1).value));
    };
    const rows: RawSheet["rows"] = [];
    for (let line = 2; line <= sheet.rowCount; line += 1) rows.push({ line, cells: readRow(line) });
    result[sheet.name.trim()] = { headers: readRow(1), rows };
  });
  return result;
}
