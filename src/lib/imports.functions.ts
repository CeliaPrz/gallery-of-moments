import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  importsToReplace,
  normalizeName,
  type CheckContext,
  type ImportPayload,
  type Value,
} from "@/lib/import-template";


async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Import réservé à l'administratrice.");
}

export type ImportInvestorContext = {
  check: CheckContext;
  lastImports: { id: string; fileName: string; templateVersion: string; importedAt: string; status: string }[];
};

/** Données de base nécessaires aux contrôles et l'encadré « Derniers imports ». */
export const getImportInvestorContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { investorId: string }) => {
    if (!input?.investorId) throw new Error("Investisseur manquant.");
    return { investorId: input.investorId };
  })
  .handler(async ({ context, data }): Promise<ImportInvestorContext> => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const [investor, assets, imports, summaries] = await Promise.all([
      supabase.from("investors").select("id, code").eq("id", data.investorId).single(),
      supabase.from("assets").select("id, code, investor_id"),
      supabase
        .from("imports")
        .select("id, file_name, template_version, imported_at, status")
        .eq("investor_id", data.investorId)
        .order("imported_at", { ascending: false })
        .limit(5),
      supabase.from("asset_summary").select("code, as_of_date").eq("investor_id", data.investorId),
    ]);
    if (investor.error) throw new Error(investor.error.message);
    if (assets.error) throw new Error(assets.error.message);
    const own = (assets.data ?? []).filter((a) => a.investor_id === data.investorId);
    const codeById = new Map(own.map((a) => [a.id, a.code]));
    const units = own.length
      ? await supabase.from("units").select("asset_id, label").in("asset_id", own.map((a) => a.id))
      : { data: [] as { asset_id: string; label: string }[] };

    return {
      check: {
        investorId: data.investorId,
        investorCode: investor.data.code,
        existingAssets: (assets.data ?? []).map((a) => ({ code: a.code, investorId: a.investor_id })),
        existingUnits: (units.data ?? []).map((u) => ({ assetCode: codeById.get(u["asset_id"]) ?? "", label: u["label"] })),
        currentAsOf: (summaries.data ?? []).map((s) => ({ assetCode: s.code as string, asOfDate: s.as_of_date })),
      },
      lastImports: (imports.data ?? []).map((i) => ({
        id: i.id,
        fileName: i.file_name,
        templateVersion: i.template_version,
        importedAt: i.imported_at,
        status: i.status,
      })),
    };
  });

const ASSET_FIELDS = [
  "name", "address", "postal_code", "city", "asset_type", "lettable_area_sqm", "units_count",
  "parking_spaces", "year_built", "year_renovated", "acquisition_date", "strategy",
  "cadastral_reference", "description",
] as const;

const pick = (row: Record<string, Value>, fields: readonly string[]) =>
  Object.fromEntries(fields.map((f) => [f, row[f] ?? null]));

function fail(step: string, error: { message: string } | null): asserts error is null {
  if (error) throw new Error(`${step} : ${error.message}`);
}

/**
 * Étapes 2 à 7 de la validation. Le fichier a déjà été déposé (étape 1).
 * En cas d'échec : suppression de la ligne imports (cascade sur ses données)
 * et du fichier déposé, puis renvoi de l'erreur.
 */
export const commitImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { investorId: string; fileName: string; filePath: string; payload: ImportPayload }) => {
    if (!input?.investorId || !input.fileName || !input.filePath || !input.payload?.asOfDate) {
      throw new Error("Informations d'import incomplètes.");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    await assertAdmin(supabase, context.userId);
    const p = data.payload;

    const { data: investor } = await supabase.from("investors").select("id, code").eq("id", data.investorId).single();
    if (!investor || investor.code !== p.investorCode) {
      await supabase.storage.from("imports").remove([data.filePath]);
      throw new Error("Le code investisseur du fichier ne correspond pas à l'investisseur choisi.");
    }

    const { data: created, error: createError } = await supabase
      .from("imports")
      .insert({
        investor_id: data.investorId,
        file_name: data.fileName,
        template_version: p.templateVersion,
        file_path: data.filePath,
        as_of_date: p.asOfDate,
        imported_by: context.userId,
        status: "en_attente",
      })
      .select("id")
      .single();
    if (createError || !created) {
      await supabase.storage.from("imports").remove([data.filePath]);
      throw new Error(`Création de l'import : ${createError?.message ?? "échec"}`);
    }
    const importId = created.id;

    try {
      // 3. Actifs : création, ou complément des seuls champs vides.
      const codes = p.assets.map((a) => String(a.code));
      const { data: existing, error: e1 } = await supabase
        .from("assets")
        .select("*")
        .eq("investor_id", data.investorId)
        .in("code", codes);
      fail("Lecture des actifs", e1);
      const assetIdByCode = new Map<string, string>();
      for (const row of p.assets) {
        const code = String(row["code"]);
        const found = (existing ?? []).find((a) => a.code === code);
        if (!found) {
          const { data: inserted, error } = await supabase
            .from("assets")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert({ investor_id: data.investorId, code, ...pick(row, ASSET_FIELDS) } as any)
            .select("id")
            .single();
          fail(`Création de l'actif ${code}`, error);
          assetIdByCode.set(code, inserted!.id);
        } else {
          assetIdByCode.set(code, found.id);
          const patch: Record<string, Value> = {};
          for (const f of ASSET_FIELDS) {
            if ((found as Record<string, unknown>)[f] == null && row[f] != null) patch[f] = row[f]!;
          }
          if (Object.keys(patch).length) {
            const { error } = await supabase.from("assets").update(patch).eq("id", found.id);
            fail(`Complément de l'actif ${code}`, error);
          }
        }
      }
      const assetIds = [...assetIdByCode.values()];

      // 4. Lots : création ou mise à jour par (actif, lot), sans suppression.
      const { data: dbUnits, error: e2 } = await supabase.from("units").select("id, asset_id, label").in("asset_id", assetIds);
      fail("Lecture des lots", e2);
      const unitId = new Map((dbUnits ?? []).map((u) => [`${u["asset_id"]}\u0000${u["label"]}`, u.id]));
      for (const row of p.units) {
        const assetId = assetIdByCode.get(String(row["asset_code"]))!;
        const key = `${assetId}\u0000${String(row["label"])}`;
        const fields = pick(row, ["floor", "area_sqm", "use_type", "vacant_since"]);
        const id = unitId.get(key);
        if (id) {
          const { error } = await supabase.from("units").update(fields).eq("id", id);
          fail(`Mise à jour du lot ${String(row["label"])}`, error);
        } else {
          const { data: inserted, error } = await supabase
            .from("units")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert({ asset_id: assetId, label: String(row["label"]), ...fields } as any)
            .select("id")
            .single();
          fail(`Création du lot ${String(row["label"])}`, error);
          unitId.set(key, inserted!.id);
        }
      }

      // 5. Locataires : rapprochement par nom normalisé chez cet investisseur.
      const { data: dbTenants, error: e3 } = await supabase
        .from("tenants")
        .select("id, name, sector, tax_id")
        .eq("investor_id", data.investorId);
      fail("Lecture des locataires", e3);
      const tenantId = new Map<string, string>();
      for (const row of p.tenants) {
        const name = String(row["name"]);
        const key = normalizeName(name);
        if (tenantId.has(key)) continue;
        const found = (dbTenants ?? []).find((t) => normalizeName(t.name) === key);
        if (found) {
          tenantId.set(key, found.id);
          const patch: Record<string, Value> = {};
          if (!found.sector && row["sector"]) patch["sector"] = row["sector"];
          if (!found.tax_id && row["tax_id"]) patch["tax_id"] = row["tax_id"];
          if (Object.keys(patch).length) {
            const { error } = await supabase.from("tenants").update(patch).eq("id", found.id);
            fail(`Complément du locataire ${name}`, error);
          }
        } else {
          const { data: inserted, error } = await supabase
            .from("tenants")
            .insert({
              investor_id: data.investorId,
              name,
              sector: (row["sector"] as string | null) ?? null,
              tax_id: (row["tax_id"] as string | null) ?? null,
            })
            .select("id")
            .single();
          fail(`Création du locataire ${name}`, error);
          tenantId.set(key, inserted!.id);
        }
      }

      // 6. Données chiffrées rattachées au nouvel import.
      const aid = (row: Record<string, Value>) => assetIdByCode.get(String(row["asset_code"] ?? row["code"]))!;
      const kpis = p.assets.map((row) => ({
        asset_id: aid(row),
        import_id: importId,
        as_of_date: p.asOfDate,
        ...pick(row, ["market_value", "valuation_date", "annual_rent", "occupancy_rate", "vacant_area_sqm", "ltv"]),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fail("Indicateurs des actifs", (await supabase.from("asset_kpis").insert(kpis as any)).error);

      const leases = p.leases.map((row) => ({
        asset_id: aid(row),
        import_id: importId,
        unit_id: unitId.get(`${aid(row)}\u0000${String(row["unit_label"])}`)!,
        tenant_id: tenantId.get(normalizeName(String(row["tenant_name"])))!,
        is_active: true,
        ...pick(row, [
          "start_date", "end_date", "break_date", "annual_rent", "indexation", "area_sqm", "parking_spaces",
          "rent_free_months", "rent_free_end_date", "security_deposit", "bank_guarantee_amount",
          "bank_guarantee_expiry", "recoverable_charges",
        ]),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (leases.length) fail("Baux", (await supabase.from("leases").insert(leases as any)).error);

      const loans = p.loans.map((row) => ({
        asset_id: aid(row),
        import_id: importId,
        ...pick(row, [
          "lender", "outstanding", "maturity_date", "ltv", "ltv_covenant", "icr", "icr_covenant",
          "interest_rate", "rate_type", "reference_index", "margin", "amortization_type",
        ]),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (loans.length) fail("Financement", (await supabase.from("loans").insert(loans as any)).error);

      const bp = p.bpVersions.map((row) => ({
        asset_id: aid(row),
        import_id: importId,
        is_current: row["is_current"] === "oui",
        ...pick(row, ["version_label", "version_date", "initial_yield", "target_irr", "comment"]),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (bp.length) fail("Business plan", (await supabase.from("bp_versions").insert(bp as any)).error);

      // 7. Validation et remplacement des imports entièrement couverts.
      const { data: previous, error: e4 } = await supabase
        .from("imports")
        .select("id")
        .eq("investor_id", data.investorId)
        .eq("status", "valide")
        .neq("id", importId);
      fail("Lecture des imports précédents", e4);
      const prevIds = (previous ?? []).map((i) => i.id);
      const coverage = new Map<string, Set<string>>(prevIds.map((id) => [id, new Set()]));
      if (prevIds.length) {
        for (const table of ["asset_kpis", "leases", "loans", "bp_versions"] as const) {
          const { data: linked, error } = await supabase.from(table).select("import_id, asset_id").in("import_id", prevIds);
          fail("Lecture des imports précédents", error);
          for (const l of linked ?? []) coverage.get(l["import_id"])?.add(l["asset_id"]);
        }
      }
      const replaced = importsToReplace(
        [...coverage].map(([id, set]) => ({ id, assetIds: [...set] })),
        assetIds,
      );

      fail("Validation", (await supabase.from("imports").update({ status: "valide" }).eq("id", importId)).error);
      if (replaced.length) {
        const { error } = await supabase
          .from("imports")
          .update({ status: "remplace", replaced_by: importId })
          .in("id", replaced);
        fail("Remplacement des imports précédents", error);
      }

      return { importId, assetsCount: p.assets.length, asOfDate: p.asOfDate };
    } catch (error) {
      await supabase.from("imports").delete().eq("id", importId);
      await supabase.storage.from("imports").remove([data.filePath]);
      throw error instanceof Error ? error : new Error(String(error));
    }
  });

