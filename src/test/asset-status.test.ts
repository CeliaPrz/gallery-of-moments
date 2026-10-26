import { describe, expect, it } from "vitest";
import { anonymizedTenantPatch, exitReasonLabel, isExited, splitByStatus } from "@/lib/asset-status";

describe("actifs sortis", () => {
  it("un actif sorti est exclu de la liste principale", () => {
    const { active, exited } = splitByStatus([{ assetId: "a" }, { assetId: "b" }], new Set(["b"]));
    expect(active.map((r) => r.assetId)).toEqual(["a"]);
    expect(exited.map((r) => r.assetId)).toEqual(["b"]);
  });
  it("statut et motifs", () => {
    expect(isExited("sorti")).toBe(true);
    expect(isExited("en_portefeuille")).toBe(false);
    expect(exitReasonLabel("vente")).toBe("Vente");
    expect(exitReasonLabel("fin_de_mandat")).toBe("Fin de mandat");
  });
});

describe("anonymisation", () => {
  it("efface le nom et le NIF", () => {
    const patch = anonymizedTenantPatch(new Date("2026-10-27T00:00:00Z"));
    expect(patch.name).toBe("Locataire anonymisé");
    expect(patch.tax_id).toBeNull();
    expect(patch.anonymized_at).toBe("2026-10-27T00:00:00.000Z");
  });
});
