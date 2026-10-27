import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { getPublishedReportDownload, listPublishedReports, type PublishedReport } from "@/lib/reports.functions";

type Row = Record<string, unknown>;
const report = (overrides: Row = {}): Row => ({
  id: "report-1", period_label: "T1 2026", period_end: "2026-03-31", version: 1,
  status: "valide", validated_at: "2026-04-02T12:00:00Z", correction_reason: null,
  pdf_path: "investor-1/T1 2026_v1.pdf", ...overrides,
});

function mockClient(reports: Row[], profile: Row | null = { role: "investor", is_active: true, investor_id: "investor-1" }) {
  const calls: { table: string; column: string; value: unknown }[] = [];
  const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example/storage/v1/object/sign/reports/pdf?token=synthetic" }, error: null });
  const storageFrom = vi.fn(() => ({ createSignedUrl: sign }));
  const from = vi.fn((table: string) => {
    let rows = table === "profiles" ? (profile ? [profile] : []) : [...reports];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        calls.push({ table, column, value });
        if (table !== "profiles") rows = rows.filter((row) => row[column] === value);
        return query;
      },
      in: (column: string, values: unknown[]) => {
        calls.push({ table, column, value: values });
        rows = rows.filter((row) => values.includes(row[column]));
        return query;
      },
      order: () => query,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  });
  return { supabase: { from, storage: { from: storageFrom } }, calls, from, sign, storageFrom };
}

type Context = { supabase: ReturnType<typeof mockClient>["supabase"]; userId: string };
const list = listPublishedReports as unknown as (input: { context: Context }) => Promise<PublishedReport[]>;
const download = getPublishedReportDownload as unknown as (input: { context: Context; data: string }) => Promise<{ url: string }>;
const context = (client: ReturnType<typeof mockClient>): Context => ({ supabase: client.supabase, userId: "investor-user-1" });

afterEach(() => vi.unstubAllEnvs());

describe("rapports publiés côté investisseur", () => {
  it("lit uniquement les statuts validé et envoyé, sans signer de lien pendant la lecture", async () => {
    const client = mockClient([
      report({ id: "draft", status: "brouillon", period_label: "T3 2026" }),
      report({ id: "sent", status: "envoye", period_label: "T2 2026", period_end: "2026-06-30" }),
      report(),
    ]);
    const rows = await list({ context: context(client) });
    expect(rows.map((row) => row.id)).toEqual(["sent", "report-1"]);
    expect(client.calls).toContainEqual({ table: "reports", column: "status", value: ["valide", "envoye"] });
    expect(client.sign).not.toHaveBeenCalled();
  });

  it("ne renvoie que la version publiée la plus élevée par trimestre, du plus récent au plus ancien", async () => {
    const client = mockClient([
      report({ id: "old", version: 1 }),
      report({ id: "current", version: 3, correction_reason: "Correction de la valeur" }),
      report({ id: "middle", version: 2 }),
      report({ id: "draft", version: 4, status: "brouillon" }),
      report({ id: "recent", period_label: "T2 2026", period_end: "2026-06-30", status: "envoye" }),
    ]);
    expect((await list({ context: context(client) })).map((row) => [row.id, row.version])).toEqual([["recent", 1], ["current", 3]]);
  });

  it("signale une correction dès la version 2 et conserve son motif", async () => {
    const client = mockClient([report({ version: 2, correction_reason: "Correction de la valeur" })]);
    expect((await list({ context: context(client) }))[0]).toMatchObject({ isCorrected: true, correctionReason: "Correction de la valeur" });
    expect((await list({ context: context(mockClient([report()])) }))[0]?.isCorrected).toBe(false);
  });

  it.each([null, "", "   "])("rend le téléchargement indisponible sans pdf_path (%s)", async (pdf_path) => {
    const client = mockClient([report({ pdf_path })]);
    expect((await list({ context: context(client) }))[0]?.hasPdf).toBe(false);
    await expect(download({ context: context(client), data: "report-1" })).rejects.toThrow();
    expect(client.sign).not.toHaveBeenCalled();
  });

  it("renvoie une liste vide si la base ne renvoie aucun rapport", async () => {
    expect(await list({ context: context(mockClient([])) })).toEqual([]);
  });

  it.each([
    null,
    { role: "investor", is_active: false, investor_id: "investor-1" },
    { role: "admin", is_active: true, investor_id: "investor-1" },
    { role: "investor", is_active: true, investor_id: null },
  ])("refuse liste et téléchargement sans profil investisseur actif (%j)", async (profile) => {
    const client = mockClient([report()], profile);
    await expect(list({ context: context(client) })).rejects.toThrow();
    await expect(download({ context: context(client), data: "report-1" })).rejects.toThrow();
    expect(client.from.mock.calls.every(([table]) => table === "profiles")).toBe(true);
    expect(client.sign).not.toHaveBeenCalled();
  });

  it.each([[], [report({ status: "brouillon" })], [report({ id: "different-report" })]])("ne signe aucun rapport absent de la lecture autorisée ou non publié", async (rows) => {
    const client = mockClient(rows);
    await expect(download({ context: context(client), data: "report-1" })).rejects.toThrow();
    expect(client.sign).not.toHaveBeenCalled();
  });

  it("relit le rapport à chaque téléchargement et signe son chemin en base pour 20 secondes", async () => {
    vi.stubEnv("SUPABASE_URL", "https://storage.example");
    vi.stubEnv("VITE_SUPABASE_URL", "https://browser.example");
    const client = mockClient([report()]);
    const result = await download({ context: context(client), data: "report-1" });
    expect(client.calls).toContainEqual({ table: "reports", column: "id", value: "report-1" });
    expect(client.calls).toContainEqual({ table: "reports", column: "status", value: ["valide", "envoye"] });
    expect(client.storageFrom).toHaveBeenCalledWith("reports");
    expect(client.sign).toHaveBeenCalledExactlyOnceWith("investor-1/T1 2026_v1.pdf", 20, { download: true });
    expect(result.url).toBe("https://browser.example/storage/v1/object/sign/reports/pdf?token=synthetic");
  });

  it("refuse de renvoyer un lien si le stockage refuse la signature", async () => {
    const client = mockClient([report()]);
    client.sign.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(download({ context: context(client), data: "report-1" })).rejects.toThrow();
  });
});