import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { anonymizedTenantPatch, type ExitReason } from "./asset-status";

type Ctx = { supabase: any; userId: string };

async function assertAdmin({ supabase, userId }: Ctx) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "admin") throw new Error("Action réservée à l'administratrice.");
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fail = (error: unknown) => { if (error) throw new Error("L'enregistrement a échoué."); };

export const setAssetExit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { assetId: string; exitDate: string; exitReason: ExitReason }) => {
    if (!i.assetId || !isDate(i.exitDate) || !["vente", "fin_de_mandat"].includes(i.exitReason)) {
      throw new Error("Date et motif de sortie obligatoires.");
    }
    return i;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("assets")
      .update({ status: "sorti", exit_date: data.exitDate, exit_reason: data.exitReason }).eq("id", data.assetId);
    fail(error);
    return { ok: true };
  });

export const restoreAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { assetId: string }) => i)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("assets")
      .update({ status: "en_portefeuille", exit_date: null, exit_reason: null }).eq("id", data.assetId);
    fail(error);
    return { ok: true };
  });

type ContactInput = {
  id?: string | undefined; tenantId: string; fullName: string;
  roleTitle: string | null; email: string | null; phone: string | null;
};

export const saveTenantContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: ContactInput) => {
    if (!i.tenantId || !i.fullName?.trim()) throw new Error("Le nom du contact est obligatoire.");
    return i;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = {
      tenant_id: data.tenantId, full_name: data.fullName.trim(),
      role_title: data.roleTitle?.trim() || null, email: data.email?.trim() || null, phone: data.phone?.trim() || null,
    };
    const { error } = data.id
      ? await context.supabase.from("tenant_contacts").update(row).eq("id", data.id)
      : await context.supabase.from("tenant_contacts").insert(row);
    fail(error);
    return { ok: true };
  });

export const deleteTenantContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("tenant_contacts").delete().eq("id", data.id);
    fail(error);
    return { ok: true };
  });

export const anonymizeTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tenantId: string }) => i)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const del = await context.supabase.from("tenant_contacts").delete().eq("tenant_id", data.tenantId);
    fail(del.error);
    const { error } = await context.supabase.from("tenants").update(anonymizedTenantPatch()).eq("id", data.tenantId);
    fail(error);
    return { ok: true };
  });

export const setLeaseActualEnd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { leaseId: string; actualEndDate: string | null }) => {
    if (!i.leaseId || (i.actualEndDate !== null && !isDate(i.actualEndDate))) throw new Error("Date invalide.");
    return i;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("leases")
      .update({ actual_end_date: data.actualEndDate }).eq("id", data.leaseId);
    fail(error);
    return { ok: true };
  });
