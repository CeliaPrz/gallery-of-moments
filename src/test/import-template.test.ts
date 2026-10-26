import { describe, expect, it } from "vitest";
import {
  checkWorkbook,
  importsToReplace,
  MAX_FILE_BYTES,
  TEMPLATE,
  type CheckContext,
  type RawCell,
  type RawWorkbook,
} from "@/lib/import-template";

const ctx: CheckContext = {
  investorId: "inv",
  investorCode: "FAEB",
  existingAssets: [{ code: "AUTRE", investorId: "other" }],
  existingUnits: [],
  currentAsOf: [],
};

type Rows = Record<string, RawCell>[];
function sheet(name: string, rows: Rows) {
  const cols = TEMPLATE[name]!;
  return {
    headers: cols.map((c) => (c.required ? `${c.name} *` : c.name)),
    rows: rows.map((r, i) => ({ line: i + 2, cells: cols.map((c) => r[c.name] ?? null) })),
  };
}

function valid(): Record<string, Rows> {
  return {
    "Paramètres": [{ "Code investisseur": "FAEB", "Date des données": new Date(Date.UTC(2026, 8, 30)), "Version du modèle": "v1.2" }],
    Actifs: [{
      "Code actif": "A1", Nom: "N", Adresse: "Ad", Ville: "V", Type: "bureaux", "Surface locative (m²)": 300,
      "Valeur d'expertise (€)": 1000, "Date d'expertise": "01/09/2026", "Loyer annuel (€)": 100,
      "Taux d'occupation (%)": 50, "Surface vacante (m²)": 100,
    }],
    Lots: [
      { "Code actif": "A1", Lot: "L1", "Surface (m²)": 200 },
      { "Code actif": "A1", Lot: "L2", "Surface (m²)": 100, "Vacant depuis": "01/01/2026" },
    ],
    Locataires: [{ Nom: "Société X" }],
    Baux: [{ "Code actif": "A1", Lot: "L1", Locataire: "société  x", Échéance: "31/12/2030", "Loyer annuel (€)": 100 }],
    Financement: [],
    "Business plan": [{ "Code actif": "A1", Version: "V1", Date: "01/01/2026", "En vigueur": "oui" }],
  };
}
function build(data: Record<string, Rows>): RawWorkbook {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, sheet(k, v)]));
}
const run = (data = valid(), c = ctx) => checkWorkbook(build(data), c);
const has = (list: { text: string }[], part: string) => list.some((m) => m.text.includes(part));

describe("import Excel v1.2", () => {
  it("accepte un fichier conforme, sans erreur ni avertissement", () => {
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.sheetsRead).toBe(7);
    expect(r.payload?.asOfDate).toBe("2026-09-30");
  });
  it("limite la taille à 5 Mo", () => expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024));
  it("bloque un onglet manquant", () => {
    const wb = build(valid());
    delete wb["Financement"];
    expect(has(checkWorkbook(wb, ctx).errors, "Onglet Financement : onglet absent")).toBe(true);
  });
  it("bloque une colonne renommée et une colonne en trop", () => {
    const wb = build(valid());
    wb["Lots"]!.headers[2] = "Niveau";
    const r = checkWorkbook(wb, ctx);
    expect(has(r.errors, "colonne Étage : colonne absente ou renommée")).toBe(true);
    expect(has(r.errors, "« Niveau » : colonne en trop")).toBe(true);
    expect(r.payload).toBeNull();
  });
  it("bloque un code investisseur ou une version différents", () => {
    const d = valid();
    d["Paramètres"]![0]!["Code investisseur"] = "OFO";
    d["Paramètres"]![0]!["Version du modèle"] = "v1.1";
    const r = run(d);
    expect(has(r.errors, "Code investisseur")).toBe(true);
    expect(has(r.errors, "n'est pas v1.2")).toBe(true);
  });
  it("bloque une valeur obligatoire vide", () => {
    const d = valid();
    d["Actifs"]![0]!["Ville"] = " ";
    expect(has(run(d).errors, "Onglet Actifs, ligne 2, colonne Ville : valeur obligatoire manquante")).toBe(true);
  });
  it("bloque une date invalide avec le message attendu", () => {
    const d = valid();
    d["Baux"]![0]!["Échéance"] = "31/02/2029";
    expect(run(d).errors.map((e) => e.text)).toContain(
      "Onglet Baux, ligne 2, colonne Échéance : la date « 31/02/2029 » n'est pas valide. Corrigez la date dans le fichier puis déposez le fichier à nouveau.",
    );
  });
  it("bloque un nombre écrit en texte et une valeur hors liste", () => {
    const d = valid();
    d["Actifs"]![0]!["Valeur d'expertise (€)"] = "1 090 000";
    d["Actifs"]![0]!["Type"] = "hôtel";
    const r = run(d);
    expect(has(r.errors, "« 1 090 000 » est écrit en texte")).toBe(true);
    expect(has(r.errors, "« hôtel » ne fait pas partie de la liste")).toBe(true);
  });
  it("bloque une surface négative et un pourcentage hors de 0 à 100", () => {
    const d = valid();
    d["Lots"]![0]!["Surface (m²)"] = -1;
    d["Actifs"]![0]!["Taux d'occupation (%)"] = 120;
    const r = run(d);
    expect(has(r.errors, "« -1 » est négative")).toBe(true);
    expect(has(r.errors, "« 120 » est hors de 0 à 100")).toBe(true);
  });
  it("bloque les liens incohérents", () => {
    const d = valid();
    d["Actifs"]!.push({ ...d["Actifs"]![0]!, "Code actif": "AUTRE" });
    d["Lots"]!.push({ "Code actif": "A1", Lot: "L1", "Surface (m²)": 1 }, { "Code actif": "ZZ", Lot: "L", "Surface (m²)": 1 });
    d["Baux"]!.push({ "Code actif": "A1", Lot: "L9", Locataire: "Inconnu", Échéance: "01/01/2030", "Loyer annuel (€)": 1 });
    const r = run(d);
    expect(has(r.errors, "« AUTRE » est déjà attribué à un autre investisseur")).toBe(true);
    expect(has(r.errors, "« L1 » est en double")).toBe(true);
    expect(has(r.errors, "« ZZ » est absent de l'onglet Actifs")).toBe(true);
    expect(has(r.errors, "« L9 » n'existe pas pour l'actif A1")).toBe(true);
    expect(has(r.errors, "« Inconnu » n'existe pas dans l'onglet Locataires")).toBe(true);
  });
  it("bloque un code actif en double dans Actifs", () => {
    const d = valid();
    d["Actifs"]!.push({ ...d["Actifs"]![0]! });
    expect(has(run(d).errors, "« A1 » est en double")).toBe(true);
  });
  it("exige exactement une version en vigueur par actif", () => {
    const d = valid();
    d["Business plan"]!.push({ "Code actif": "A1", Version: "V2", Date: "01/02/2026", "En vigueur": "oui" });
    expect(has(run(d).errors, "plusieurs version")).toBe(true);
    d["Business plan"] = [];
    expect(has(run(d).errors, "aucune version")).toBe(true);
  });
  it("exige au moins un lot par actif", () => {
    const d = valid();
    d["Lots"] = [];
    d["Baux"] = [];
    expect(has(run(d).errors, "n'a aucun lot")).toBe(true);
  });
  it("avertit sans bloquer sur les incohérences de chiffres", () => {
    const d = valid();
    d["Actifs"]![0]!["Loyer annuel (€)"] = 999;
    d["Actifs"]![0]!["Surface locative (m²)"] = 999;
    d["Actifs"]![0]!["Surface vacante (m²)"] = 5;
    d["Actifs"]![0]!["LTV (%)"] = 0.48;
    d["Lots"]!.push({ "Code actif": "A1", Lot: "L3", "Surface (m²)": 0 });
    d["Financement"] = [{ "Code actif": "A1", Prêteur: "P", "Encours (€)": 1, "LTV (%)": 50, "Covenant LTV (%)": 55 }];
    const r = run(d, { ...ctx, existingUnits: [{ assetCode: "A1", label: "L0" }], currentAsOf: [{ assetCode: "A1", asOfDate: "2026-12-31" }] });
    expect(r.errors).toEqual([]);
    expect(r.payload).not.toBeNull();
    for (const part of ["somme des loyers", "somme des surfaces", "surface des lots vacants", "n'a ni bail ni date", "probablement écrit en fraction", "covenant moins 5 points", "plus ancienne", "« L0 »"]) {
      expect(has(r.warnings, part)).toBe(true);
    }
  });
});

describe("remplacement des imports précédents", () => {
  it("remplace seulement un import dont tous les actifs sont couverts", () => {
    expect(importsToReplace([{ id: "a", assetIds: ["1", "2"] }, { id: "b", assetIds: ["1", "3"] }], ["1", "2"])).toEqual(["a"]);
  });
});
