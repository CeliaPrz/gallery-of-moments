import { describe, expect, it } from "vitest";
import { reportNotices } from "@/lib/reports";
const now = new Date("2026-10-27T12:00:00Z");
describe("reportNotices", () => {
  it("garde les rapports validés il y a moins de 30 jours", () => {
    const r = reportNotices([{ id: "a", validatedAt: "2026-10-01T00:00:00Z" }, { id: "b", validatedAt: "2026-09-20T00:00:00Z" }], now, new Set());
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });
  it("exclut les rapports fermés", () => {
    expect(reportNotices([{ id: "a", validatedAt: "2026-10-20T00:00:00Z" }], now, new Set(["a"]))).toEqual([]);
  });
});
