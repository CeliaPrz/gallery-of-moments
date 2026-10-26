import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { MaterialIcon } from "@/components/material-icon";
import { LurShell } from "@/components/lur-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { getImportContext, whoami } from "@/lib/lur.functions";
import { commitImport, getImportInvestorContext } from "@/lib/imports.functions";
import {
  checkWorkbook,
  MAX_FILE_BYTES,
  readWorkbook,
  TEMPLATE_VERSION,
  type CheckResult,
  type Value,
} from "@/lib/import-template";

const investorContextOptions = (investorId: string) =>
  queryOptions({
    queryKey: ["import-investor", investorId],
    queryFn: () => getImportInvestorContext({ data: { investorId } }),
    enabled: Boolean(investorId),
  });

function formatCell(value: Value): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return value;
}

function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

const STATUS_STYLES: Record<string, string> = {
  valide: "bg-secondary-container text-primary",
  remplace: "bg-surface-container-high text-on-surface-variant",
  en_attente: "bg-tertiary-fixed text-on-tertiary-fixed",
};

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

const STATUS_LABELS: Record<string, string> = {
  valide: "Validé",
  en_attente: "En attente",
  remplace: "Remplacé",
};

function ImportPage() {
  const { data: context } = useSuspenseQuery(importQueryOptions);
  const { data: me } = useSuspenseQuery(whoamiQueryOptions);

  const queryClient = useQueryClient();
  const [investorId, setInvestorId] = useState(context.selectedInvestorId ?? "");
  const [queue, setQueue] = useState<File[]>([]);
  const [raw, setRaw] = useState<{ file: File; workbook: Awaited<ReturnType<typeof readWorkbook>> } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number; asOfDate: string; investorId: string } | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedInvestor = context.investors.find((investor) => investor.id === investorId);
  const investorContext = useQuery(investorContextOptions(investorId));
  const file = queue[0] ?? null;

  useEffect(() => {
    if (!file) {
      setRaw(null);
      return;
    }
    let cancelled = false;
    setParsing(true);
    setRaw(null);
    readWorkbook(file)
      .then((workbook) => {
        if (!cancelled) setRaw({ file, workbook });
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Lecture impossible", { description: "Le classeur n'a pas pu être ouvert." });
        setQueue((q) => q.slice(1));
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const parsed: CheckResult | null = useMemo(
    () => (raw && investorContext.data ? checkWorkbook(raw.workbook, investorContext.data.check) : null),
    [raw, investorContext.data],
  );

  function acceptFiles(list: FileList | File[] | null | undefined) {
    const accepted: File[] = [];
    for (const next of Array.from(list ?? [])) {
      if (!next.name.toLowerCase().endsWith(".xlsx")) {
        toast.error(`Format non accepté : ${next.name}`, { description: "Seuls les fichiers .xlsx sont admis." });
        continue;
      }
      if (next.size > MAX_FILE_BYTES) {
        toast.error(`Fichier trop volumineux : ${next.name}`, { description: "Taille maximale : 5 Mo." });
        continue;
      }
      accepted.push(next);
    }
    if (accepted.length) {
      setFailure(null);
      setSuccess(null);
      setActiveSheet(0);
      setQueue((q) => [...q, ...accepted]);
    }
  }

  function nextFile() {
    setActiveSheet(0);
    setQueue((q) => q.slice(1));
  }

  async function validateImport() {
    if (!file || !parsed?.payload || !investorContext.data || !investorId) return;
    setSaving(true);
    setFailure(null);
    const filePath = `${investorContext.data.check.investorCode}/${stamp(new Date())}_${file.name}`;
    try {
      const { error } = await supabase.storage.from("imports").upload(filePath, file, {
        contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (error) throw new Error(`Dépôt du fichier : ${error.message}`);
      const result = await commitImport({
        data: { investorId, fileName: file.name, filePath, payload: parsed.payload },
      });
      setSuccess({ count: result.assetsCount, asOfDate: result.asOfDate, investorId });
      await queryClient.invalidateQueries();
      nextFile();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  const blocked = (parsed?.errors.length ?? 0) > 0;
  const sheet = parsed?.preview[activeSheet];
  const lastImports = investorContext.data?.lastImports ?? [];

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
              acceptFiles(event.dataTransfer.files);
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
              Fichiers acceptés : .xlsx uniquement (taille max 5 Mo)
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
              multiple
              className="hidden"
              onChange={(event) => {
                acceptFiles(event.target.files);
                event.target.value = "";
              }}
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
                    Fichier chargé · modèle {TEMPLATE_VERSION} · {Math.round(file.size / 1024)} Ko
                    {parsing ? " · lecture…" : ""}
                    {queue.length > 1 ? ` · ${queue.length - 1} fichier(s) en attente` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Recharger le fichier"
                  onClick={() => {
                    const current = file;
                    setQueue((q) => [new File([current], current.name, { type: current.type }), ...q.slice(1)]);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
                >
                  <MaterialIcon name="sync" className="text-[18px]" />
                </button>
                <button
                  type="button"
                  aria-label="Retirer le fichier"
                  onClick={nextFile}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
                >
                  <MaterialIcon name="delete" className="text-[18px]" />
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/60 bg-secondary-container p-4">
              <p className="flex items-center gap-2 font-body-md text-[13px] font-semibold text-primary">
                <MaterialIcon name="check_circle" className="text-[18px]" />
                Import validé : {success.count} actifs mis à jour au {formatDate(success.asOfDate)}.
              </p>
              <Link
                to="/"
                search={{ investisseur: success.investorId }}
                className="font-label-sm text-[11px] uppercase tracking-wider text-primary hover:underline"
              >
                Tableau de bord
              </Link>
            </div>
          )}
          {investorContext.isError && (
            <p role="alert" className="mt-4 font-body-sm text-error">
              {investorContext.error instanceof Error ? investorContext.error.message : String(investorContext.error)}
            </p>
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
                  {parsed.sheetsRead} onglets lus
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-3 py-1 font-label-sm text-[10px] uppercase tracking-wider text-on-tertiary-fixed">
                  <MaterialIcon name="warning" className="text-[14px]" />
                  {parsed.warnings.length} avertissement
                  {parsed.warnings.length > 1 ? "s" : ""}
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
                <p className="mt-2 font-body-sm text-[12px] text-on-surface-variant">{error.text}</p>
              </div>
            ))}

            {parsed.warnings.map((warning, index) => (
              <div
                key={`w-${index}`}
                className="mb-3 rounded-lg border border-tertiary-fixed-dim/60 bg-tertiary-fixed/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <MaterialIcon name="priority_high" className="text-[16px] text-tertiary" />
                  <p className="font-body-md text-[13px] font-semibold text-on-tertiary-fixed">
                    Avertissement
                  </p>
                </div>
                <p className="mt-2 font-body-sm text-[12px] text-on-surface-variant">{warning.text}</p>
              </div>
            ))}

            <div className="mb-4 flex flex-wrap gap-1 border-b border-outline-variant/60">
              {parsed.preview.map((entry, index) => (
                <button
                  key={entry.sheet}
                  type="button"
                  onClick={() => setActiveSheet(index)}
                  className={`border-b-2 px-3 py-2 font-body-md text-[13px] transition-colors ${
                    index === activeSheet
                      ? "border-primary text-primary"
                      : "border-transparent text-secondary hover:text-on-surface"
                  }`}
                >
                  {entry.sheet} ({entry.rows.length})
                </button>
              ))}
            </div>

            {sheet && sheet.rows.length === 0 && (
              <p className="font-body-sm text-secondary">Aucune ligne dans cet onglet.</p>
            )}
            {failure && (
              <p role="alert" className="mt-4 rounded-lg border border-error/30 bg-error-container/40 p-4 font-body-sm text-[12px] text-error">
                {failure}
              </p>
            )}
            {sheet && sheet.rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/60">
                      {sheet.headers.map((heading, index) => (
                        <th
                          key={index}
                          className="whitespace-nowrap px-3 py-3 font-label-md text-[11px] uppercase tracking-wider text-secondary"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row) => (
                      <tr
                        key={row.line}
                        className="border-b border-outline-variant/40 last:border-0"
                      >
                        {row.cells.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="whitespace-nowrap px-3 py-3 font-table-data text-table-data text-on-surface"
                          >
                            {formatCell(cell)}
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
                  disabled={saving}
                  onClick={nextFile}
                  className="rounded-lg border border-outline-variant px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-secondary hover:bg-surface-container-high"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={blocked || !parsed?.payload || parsing || saving}
                  title={blocked ? "Corrigez l'erreur bloquante pour valider" : undefined}
                  onClick={() => void validateImport()}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-[12px] uppercase tracking-wider text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
                >
                  <MaterialIcon name="check" className="text-[18px]" />
                  {saving ? "Validation…" : "Valider l'import"}
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

            {investorContext.isPending ? (
              <div className="h-24 animate-pulse rounded-lg bg-surface-container-high" />
            ) : lastImports.length === 0 ? (
              <p className="font-body-sm text-secondary">Aucun import enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {lastImports.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-outline-variant/40 bg-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-body-sm text-secondary">
                        {formatDate(entry.importedAt)} · {entry.templateVersion}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-wider ${STATUS_STYLES[entry.status] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 font-body-md text-[13px] text-on-surface">
                      <MaterialIcon name="file_download" className="text-[16px] text-surface-tint" />
                      {entry.fileName}
                    </p>
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
