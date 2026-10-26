import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { MaterialIcon } from "@/components/material-icon";
import { LurShell } from "@/components/lur-shell";
import { sidebarAssetsQueryOptions } from "@/lib/sidebar-assets";
import { formatDate, formatPercent } from "@/lib/format";
import { getImportContext, whoami } from "@/lib/lur.functions";
import { recordImport } from "@/lib/imports.functions";

const MAX_BYTES = 50 * 1024 * 1024;

const importQueryOptions = queryOptions({
  queryKey: ["import-context"],
  queryFn: () => getImportContext(),
});

const whoamiQueryOptions = queryOptions({
  queryKey: ["whoami"],
  queryFn: () => whoami(),
});

export const Route = createFileRoute("/_authenticated/import")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(importQueryOptions),
      context.queryClient.ensureQueryData(whoamiQueryOptions),
    ]),
  head: () => ({
    meta: [
      { title: "Importer un fichier Excel — LUR Gestion d'actifs" },
      {
        name: "description",
        content:
          "Dépôt d'un fichier Excel au format du modèle standard, avec aperçu et contrôles avant validation.",
      },
      { property: "og:title", content: "Importer un fichier Excel — LUR Gestion d'actifs" },
      {
        property: "og:description",
        content:
          "Dépôt d'un fichier Excel au format du modèle standard, avec aperçu et contrôles avant validation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 font-body-md text-error">
      {error instanceof Error ? error.message : String(error)}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 font-body-md text-secondary">Page d'import indisponible.</div>
  ),
});

type Sheet = { name: string; rows: (string | number | null)[][] };
type DateError = { sheet: string; line: number; value: string };
type Parsed = { sheets: Sheet[]; errors: DateError[] };

function invalidDateCell(value: string): boolean {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day;
}

async function parseWorkbook(file: File): Promise<Parsed> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, dateNF: "dd/mm/yyyy" });

  const sheets: Sheet[] = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[name]!, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: false,
    });
    return { name, rows };
  });

  const errors: DateError[] = [];
  for (const sheet of sheets) {
    sheet.rows.forEach((row, index) => {
      for (const cell of row) {
        if (typeof cell === "string" && invalidDateCell(cell)) {
          errors.push({ sheet: sheet.name, line: index + 1, value: cell.trim() });
        }
      }
    });
  }

  return { sheets, errors };
}

const STATUS_LABELS: Record<string, string> = {
  valide: "Validé",
  en_attente: "En attente",
  remplace: "Remplacé",
};

function ImportPage() {
  const { data: context } = useSuspenseQuery(importQueryOptions);
  const { data: me } = useSuspenseQuery(whoamiQueryOptions);

  const [investorId, setInvestorId] = useState(context.selectedInvestorId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parsing, setParsing] = useState(false);
  const [activeSheet, setActiveSheet] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedInvestor = context.investors.find((investor) => investor.id === investorId);
  const covenantWarnings = context.preview.filter(
    (asset) =>
      asset.ltv != null &&
      asset.ltvCovenant != null &&
      asset.ltv >= asset.ltvCovenant * 0.9,
  );

  async function acceptFile(next: File | undefined) {
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Format non accepté", { description: "Seuls les fichiers .xlsx sont admis." });
      return;
    }
    if (next.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux", { description: "Taille maximale : 50 Mo." });
      return;
    }
    setFile(next);
    setParsed(null);
    setParsing(true);
    try {
      const result = await parseWorkbook(next);
      setParsed(result);
      setActiveSheet(0);
    } catch {
      toast.error("Lecture impossible", { description: "Le classeur n'a pas pu être ouvert." });
    } finally {
      setParsing(false);
    }
  }

  async function validateImport() {
    if (!file || !context.schemaVersion || !investorId) return;
    try {
      await recordImport({
        data: {
          investorId,
          fileName: file.name,
          templateVersion: context.schemaVersion,
          asOfDate: new Date().toISOString().slice(0, 10),
        },
      });
      toast.success("Import enregistré", {
        description: "Statut : en attente de traitement.",
      });
      setFile(null);
      setParsed(null);
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const blocked = (parsed?.errors.length ?? 0) > 0;
  const sheet = parsed?.sheets[activeSheet];

  return (
    <LurShell
      isAdmin={me.role === "admin"}
      fullName={me.fullName}
      investorName={me.investor?.name ?? ""}
      assetsCount={selectedInvestor?.assetsCount ?? null}
      lastImportLabel={context.lastImports[0] ? formatDate(context.lastImports[0].importedAt) : null}
    >
      <main className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-label-sm text-[10px] uppercase tracking-[0.2em] text-secondary">
              {me.fullName} · Administration des données
              {context.schemaVersion ? ` · Schéma ${context.schemaVersion}` : ""}
            </p>
            <h1 className="mt-2 font-display-md text-display-md text-on-surface">
              Importer un fichier Excel
            </h1>
            <p className="mt-1 font-body-md text-secondary">
              Les chiffres financiers ne changent que par import. Aucun calcul n'est fait dans
              l'application.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Spécification non fournie"
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-high px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-outline"
          >
            <MaterialIcon name="download" className="text-[18px]" />
            Spécification schéma {context.schemaVersion ?? ""}
          </button>
        </header>

        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-label-md text-[12px] text-on-primary">
                1
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Étape 1 : Sélection de l'investisseur et fichier source
              </h2>
            </div>
            <span className="rounded-full bg-secondary-container px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-secondary-container">
              Étape active
            </span>
          </div>

          <label className="mb-2 block font-label-md text-[11px] uppercase tracking-wider text-secondary">
            Investisseur rattaché
          </label>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 bg-surface p-3">
            <MaterialIcon name="account_balance" className="text-[20px] text-surface-tint" />
            <select
              className="min-w-[260px] flex-1 bg-transparent font-body-md text-[13px] text-on-surface focus:outline-none"
              value={investorId}
              onChange={(event) => setInvestorId(event.target.value)}
            >
              {context.investors.map((investor) => (
                <option key={investor.id} value={investor.id}>
                  {investor.name} · {investor.assetsCount} actifs
                </option>
              ))}
            </select>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void acceptFile(event.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary bg-surface-container-low" : "border-outline-variant"
            }`}
          >
            <MaterialIcon name="upload_file" className="text-[32px] text-surface-tint" />
            <p className="font-body-md text-[13px] text-on-surface">
              Déposez un ou plusieurs fichiers .xlsx au format du modèle standard
            </p>
            <p className="font-audit-trail text-[11px] text-secondary">
              Fichiers acceptés : .xlsx uniquement (taille max 50 Mo)
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-on-primary hover:bg-primary-container"
            >
              <MaterialIcon name="folder_open" className="text-[18px]" />
              Parcourir l'ordinateur
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => void acceptFile(event.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-surface p-4">
              <div className="flex items-center gap-3">
                <MaterialIcon name="table_chart" className="text-[22px] text-surface-tint" />
                <div>
                  <p className="font-body-md text-[13px] font-semibold text-on-surface">
                    {file.name}
                  </p>
                  <p className="font-audit-trail text-[11px] text-secondary">
                    Fichier chargé · modèle {context.schemaVersion ?? "—"} ·{" "}
                    {Math.round(file.size / 1024)} Ko
                    {parsing ? " · lecture…" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Recharger le fichier"
                  onClick={() => void acceptFile(file)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
                >
                  <MaterialIcon name="sync" className="text-[18px]" />
                </button>
                <button
                  type="button"
                  aria-label="Retirer le fichier"
                  onClick={() => {
                    setFile(null);
                    setParsed(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
                >
                  <MaterialIcon name="delete" className="text-[18px]" />
                </button>
              </div>
            </div>
          )}
        </section>

        {parsed && (
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-label-md text-[12px] text-on-primary">
                  2
                </span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Étape 2 : Aperçu et contrôles
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant">
                  <MaterialIcon name="check_circle" className="text-[14px]" />
                  {parsed.sheets.length} onglets lus
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-tertiary-fixed">
                  <MaterialIcon name="warning" className="text-[14px]" />
                  {covenantWarnings.length} avertissement
                  {covenantWarnings.length > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-error-container">
                  <MaterialIcon name="error" className="text-[14px]" />
                  {parsed.errors.length} erreur{parsed.errors.length > 1 ? "s" : ""} bloquante
                  {parsed.errors.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {parsed.errors.map((error, index) => (
              <div
                key={`${error.sheet}-${error.line}-${index}`}
                className="mb-3 rounded-lg border border-error/30 bg-error-container/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <MaterialIcon name="close" className="text-[16px] text-error" />
                  <p className="font-body-md text-[13px] font-semibold text-on-error-container">
                    Erreur bloquante
                  </p>
                </div>
                <p className="mt-1 font-label-sm text-[11px] uppercase tracking-wider text-on-error-container">
                  Code : ERR_DATE_OUT_OF_RANGE
                </p>
                <p className="mt-2 font-body-sm text-[12px] text-on-surface-variant">
                  Onglet {error.sheet}, ligne {error.line} : la date « {error.value} » n'est pas
                  valide. Corrigez la date dans le fichier puis déposez-le à nouveau.
                </p>
              </div>
            ))}

            {covenantWarnings.map((asset) => (
              <div
                key={asset.assetId}
                className="mb-3 rounded-lg border border-tertiary-fixed-dim/60 bg-tertiary-fixed/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <MaterialIcon name="priority_high" className="text-[16px] text-tertiary" />
                  <p className="font-body-md text-[13px] font-semibold text-on-tertiary-fixed">
                    Avertissement de covenant
                  </p>
                </div>
                <p className="mt-1 font-label-sm text-[11px] uppercase tracking-wider text-on-tertiary-fixed-variant">
                  Règle de prudence financière
                </p>
                <p className="mt-2 font-body-sm text-[12px] text-on-surface-variant">
                  La LTV de {asset.name} ({formatPercent(asset.ltv)}) approche le seuil de covenant (
                  {formatPercent(asset.ltvCovenant)}).
                </p>
              </div>
            ))}

            <div className="mb-4 flex flex-wrap gap-1 border-b border-outline-variant/60">
              {parsed.sheets.map((entry, index) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => setActiveSheet(index)}
                  className={`border-b-2 px-3 py-2 font-body-md text-[13px] transition-colors ${
                    index === activeSheet
                      ? "border-primary text-primary"
                      : "border-transparent text-secondary hover:text-on-surface"
                  }`}
                >
                  {entry.name} ({Math.max(entry.rows.length - 1, 0)})
                </button>
              ))}
            </div>

            {sheet && sheet.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/60">
                      {(sheet.rows[0] ?? []).map((heading, index) => (
                        <th
                          key={index}
                          className="whitespace-nowrap px-3 py-3 font-label-md text-[11px] uppercase tracking-wider text-secondary"
                        >
                          {heading ?? ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(1, 11).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-outline-variant/40 last:border-0"
                      >
                        {(sheet.rows[0] ?? []).map((_, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface"
                          >
                            {row[cellIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MaterialIcon name="lock" className="text-[16px] text-surface-tint" />
                <p className="font-body-sm text-secondary">
                  {blocked
                    ? "L'importation est bloquée tant qu'une anomalie de format persiste."
                    : "Aucune anomalie de format : l'import peut être enregistré."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsed(null);
                  }}
                  className="rounded-lg border border-outline-variant px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-secondary hover:bg-surface-container-high"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={blocked || !file || parsing}
                  title={blocked ? "Corrigez l'erreur bloquante pour valider" : undefined}
                  onClick={() => void validateImport()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
                >
                  <MaterialIcon name="check" className="text-[18px]" />
                  Valider l'import
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MaterialIcon name="history" className="text-[20px] text-surface-tint" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Derniers imports
                </h2>
              </div>
              <button
                type="button"
                className="font-label-sm text-[11px] uppercase tracking-wider text-primary hover:underline"
              >
                Tout voir
              </button>
            </div>

            {context.lastImports.length === 0 ? (
              <p className="font-body-sm text-secondary">Aucun import enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {context.lastImports.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-outline-variant/40 bg-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-body-sm text-secondary">
                        {formatDate(entry.importedAt)} · {entry.templateVersion}
                      </p>
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 font-body-md text-[13px] text-on-surface">
                      <MaterialIcon name="file_download" className="text-[16px] text-surface-tint" />
                      {entry.fileName}
                    </p>
                    {entry.notes ? (
                      <p className="mt-1 font-audit-trail text-[11px] text-secondary">
                        {entry.notes}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
                <MaterialIcon name="verified" className="text-[20px]" />
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Modèle standard LUR
                </h2>
                <p className="mt-1 font-body-sm text-secondary">
                  Modèle Excel à utiliser pour tous les imports
                </p>
                <p className="mt-3 font-body-sm text-on-surface-variant">
                  Utilisez uniquement ce modèle : onglets, colonnes et intitulés fixes.
                </p>
                <div className="mt-4 rounded-lg bg-surface p-3">
                  <p className="font-label-md text-[11px] uppercase tracking-wider text-secondary">
                    Version courante
                  </p>
                  <p className="mt-1 font-body-md text-[13px] text-on-surface">
                    {context.schemaVersion ?? "—"}
                  </p>
                  <p className="mt-1 font-audit-trail text-[11px] text-secondary">
                    Version courante du schéma : {context.schemaVersion ?? "—"} (mise à jour du{" "}
                    {formatDate(context.schemaUpdatedAt)})
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  title="Modèle Excel non fourni"
                  className="mt-4 flex cursor-not-allowed items-center gap-2 rounded-lg bg-surface-container-high px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-outline"
                >
                  <MaterialIcon name="download_for_offline" className="text-[18px]" />
                  Télécharger le modèle Excel {context.schemaVersion ?? ""} (.xlsx)
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </LurShell>
  );
}
