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

import { generateCommentary, getReportContent, type ReportContent } from "@/lib/reports.functions";

function mockSupabase(leases: Record<string, unknown>[] = []) {
  const rows: Record<string, unknown> = {
    profiles: { role: "admin", is_active: true },
    reports: {
      id: "report-1", investor_id: "investor-1", period_label: "T1 2026",
      period_end: "2026-03-31", version: 1, status: "brouillon", commentary: null,
    },
    investors: { name: "" },
    portfolio_summary: null,
    asset_summary: [{ asset_id: "asset-1", import_id: "import-1", name: "", status: "actif" }],
    assets: [], leases, loans: [], units: [], bp_versions: [], imports: [],
  };
  return {
    from: (table: string) => {
      const result = { data: rows[table], error: null };
      const query = {
        select: () => query, eq: () => query, in: () => query,
        not: () => query, order: () => query, update: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("consignes des rapports Anthropic", () => {
  it("utilise exactement claude-sonnet-5-5 avec la clé Anthropic, sans modèles Lovable", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-a-credential");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Commentaire de test."}}\n\n',
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const run = generateCommentary as unknown as (input: {
      context: { supabase: ReturnType<typeof mockSupabase>; userId: string }; data: string;
    }) => Promise<{ commentary: string }>;

    expect(await run({ context: { supabase: mockSupabase(), userId: "admin-1" }, data: "report-1" }))
      .toEqual({ commentary: "Commentaire de test." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(options.body).model).toBe("claude-sonnet-5-5");
    expect(options.headers["x-api-key"]).toBe("test-key-not-a-credential");
  });

  it("conserve uniquement les trois prochaines échéances de bail par actif", async () => {
    const leases = ["9999-12-31", "9999-06-30", "9999-03-31", "9999-09-30", "2000-01-01"]
      .map((end_date) => ({
        asset_id: "asset-1", import_id: "import-1", is_active: true,
        end_date, break_date: null, tenant: { name: "" },
      }));
    const run = getReportContent as unknown as (input: {
      context: { supabase: ReturnType<typeof mockSupabase>; userId: string }; data: string;
    }) => Promise<{ content: ReportContent }>;
    const { content } = await run({ context: { supabase: mockSupabase(leases), userId: "admin-1" }, data: "report-1" });
    expect(content.assets[0]?.leaseEvents.map((event) => event.endDate))
      .toEqual(["9999-03-31", "9999-06-30", "9999-09-30"]);
  });
});