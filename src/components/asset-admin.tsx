import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  anonymizeTenant, deleteTenantContact, restoreAsset, saveTenantContact, setAssetExit, setLeaseActualEnd,
} from "@/lib/admin-edits.functions";
import { EXIT_REASON_LABELS, type ExitReason } from "@/lib/asset-status";
import type { AssetSheetDto } from "@/lib/lur.functions";

function useRefresh(assetId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["asset", assetId] }),
      queryClient.invalidateQueries({ queryKey: ["sidebar-assets"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };
}

async function run(action: () => Promise<unknown>, refresh: () => Promise<void>) {
  try {
    await action();
    await refresh();
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "L'enregistrement a échoué.");
    return false;
  }
}

export function ExitAssetButton({ assetId }: { assetId: string }) {
  const save = useServerFn(setAssetExit);
  const refresh = useRefresh(assetId);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState<ExitReason>("vente");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">Marquer comme sorti</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer comme sorti</DialogTitle>
          <DialogDescription>L'actif disparaîtra de l'espace de l'investisseur. Ses données restent archivées.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exit-date">Date de sortie</Label>
            <Input id="exit-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exit-reason">Motif</Label>
            <select id="exit-reason" value={reason} onChange={(e) => setReason(e.target.value as ExitReason)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 font-body-sm">
              {Object.entries(EXIT_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!date || pending} onClick={async () => {
            setPending(true);
            const ok = await run(() => save({ data: { assetId, exitDate: date, exitReason: reason } }), refresh);
            setPending(false);
            if (ok) setOpen(false);
          }}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RestoreAssetButton({ assetId }: { assetId: string }) {
  const restore = useServerFn(restoreAsset);
  const refresh = useRefresh(assetId);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm">Remettre en portefeuille</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Remettre en portefeuille</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => run(() => restore({ data: { assetId } }), refresh)}>Confirmer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ActualEndEditor({ assetId, leaseId, value }: { assetId: string; leaseId: string; value: string | null }) {
  const save = useServerFn(setLeaseActualEnd);
  const refresh = useRefresh(assetId);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(value ?? "");
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setDate(value ?? ""); }}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Modifier la fin réelle" className="ml-2 inline-flex text-secondary hover:text-primary">
          <Pencil width={14} height={14} style={{ width: 14, height: 14 }} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Fin réelle</DialogTitle></DialogHeader>
        <Input type="date" aria-label="Fin réelle" value={date} onChange={(e) => setDate(e.target.value)} />
        <DialogFooter>
          <Button onClick={async () => {
            if (await run(() => save({ data: { leaseId, actualEndDate: date || null } }), refresh)) setOpen(false);
          }}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Contact = AssetSheetDto["tenantContacts"][number]["contacts"][number];

function ContactDialog({ assetId, tenantId, contact, trigger }: {
  assetId: string; tenantId: string; contact?: Contact; trigger: React.ReactNode;
}) {
  const save = useServerFn(saveTenantContact);
  const refresh = useRefresh(assetId);
  const [open, setOpen] = useState(false);
  const empty = { fullName: "", roleTitle: "", email: "", phone: "" };
  const [form, setForm] = useState(empty);
  const fields: [keyof typeof empty, string, string][] = [
    ["fullName", "Nom", "text"], ["roleTitle", "Fonction", "text"], ["email", "E-mail", "email"], ["phone", "Téléphone", "tel"],
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) setForm(contact ? { fullName: contact.fullName, roleTitle: contact.roleTitle ?? "", email: contact.email ?? "", phone: contact.phone ?? "" } : empty);
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{contact ? "Modifier" : "Ajouter"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map(([key, label, type]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`c-${key}`}>{label}</Label>
              <Input id={`c-${key}`} type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button disabled={!form.fullName.trim()} onClick={async () => {
            const ok = await run(() => save({ data: {
              id: contact?.id, tenantId, fullName: form.fullName,
              roleTitle: form.roleTitle || null, email: form.email || null, phone: form.phone || null,
            } }), refresh);
            if (ok) setOpen(false);
          }}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TenantContactsBlock({ assetId, tenants }: { assetId: string; tenants: AssetSheetDto["tenantContacts"] }) {
  const remove = useServerFn(deleteTenantContact);
  const anonymize = useServerFn(anonymizeTenant);
  const refresh = useRefresh(assetId);
  return (
    <section className="mt-6 border-t border-outline-variant/40 pt-5">
      <h3 className="mb-4 font-body-md font-semibold">Contacts des locataires</h3>
      <div className="space-y-5">
        {tenants.map((tenant) => (
          <div key={tenant.tenantId} className="rounded-lg border border-outline-variant/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className={`font-body-md text-on-surface ${tenant.anonymized ? "italic" : "font-semibold"}`}>{tenant.tenantName}</p>
              {!tenant.anonymized && (
                <div className="flex gap-2">
                  <ContactDialog assetId={assetId} tenantId={tenant.tenantId}
                    trigger={<Button variant="outline" size="sm">Ajouter</Button>} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-secondary">Anonymiser</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Anonymiser</AlertDialogTitle>
                        <AlertDialogDescription>Le nom, le NIF et les contacts seront effacés définitivement. Les baux et les chiffres sont conservés.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => run(() => anonymize({ data: { tenantId: tenant.tenantId } }), refresh)}>Confirmer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
            {tenant.contacts.length === 0 ? <p className="font-body-sm text-secondary">—</p> : (
              <ul className="divide-y divide-outline-variant/40">
                {tenant.contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="min-w-0 font-body-sm">
                      <p className="text-on-surface">{c.fullName}{c.roleTitle ? ` · ${c.roleTitle}` : ""}</p>
                      <p className="text-secondary">{c.email || "—"} · {c.phone || "—"}</p>
                    </div>
                    <div className="flex gap-2">
                      <ContactDialog assetId={assetId} tenantId={tenant.tenantId} contact={c}
                        trigger={<Button variant="ghost" size="sm">Modifier</Button>} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-brick">Supprimer</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Supprimer</AlertDialogTitle>
                            <AlertDialogDescription>{c.fullName}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => run(() => remove({ data: { id: c.id } }), refresh)}>Confirmer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
