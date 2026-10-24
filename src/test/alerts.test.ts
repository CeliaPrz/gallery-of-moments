import { describe, expect, it } from "vitest";

import { buildAlerts, COVENANT_PROXIMITY_RATIO } from "@/lib/alerts";

const ASSET_ID = "11111111-0000-0000-0000-00000000000a";
const OTHER_ID = "11111111-0000-0000-0000-00000000000b";

const assets = [
  { assetId: ASSET_ID, name: "Arturo Soria 45" },
  { assetId: OTHER_ID, name: "Méndez Álvaro 9" },
];

function withLoan(ltv: number, covenant: number) {
  return buildAlerts(assets, [{ asset_id: ASSET_ID, ltv, ltv_covenant: covenant }], [], []);
}

describe("règle de proximité du covenant", () => {
  it("signale un LTV à 51,8 % pour un covenant de 55 %", () => {
    const alerts = withLoan(51.8, 55);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "covenant", ltv: 51.8, covenant: 55 });
  });

  it("ne signale pas un LTV à 45 % pour un covenant de 55 %", () => {
    expect(withLoan(45, 55)).toEqual([]);
  });

  it("utilise le seuil de 90 % du covenant", () => {
    expect(COVENANT_PROXIMITY_RATIO).toBe(0.9);
    expect(withLoan(49.5, 55)).toHaveLength(1);
    expect(withLoan(49.4, 55)).toEqual([]);
  });

  it("ignore un prêt dont le covenant n'est pas renseigné", () => {
    expect(buildAlerts(assets, [{ asset_id: ASSET_ID, ltv: 60, ltv_covenant: null }], [], [])).toEqual(
      [],
    );
  });
});

describe("alerte d'échéance", () => {
  it("n'retient que la prochaine échéance du portefeuille", () => {
    const alerts = buildAlerts(
      assets,
      [],
      [
        { asset_id: ASSET_ID, tenant_name: "Nexa Consulting", end_date: "2028-12-31" },
        { asset_id: OTHER_ID, tenant_name: "Grupo Iberluz", end_date: "2027-06-30" },
      ],
      [],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "echeance", assetId: OTHER_ID, endDate: "2027-06-30" });
  });

  it("ignore une échéance déjà passée", () => {
    const alerts = buildAlerts(
      assets,
      [],
      [{ asset_id: ASSET_ID, tenant_name: "Nexa Consulting", end_date: "2020-01-31" }],
      [],
    );
    expect(alerts).toEqual([]);
  });
});

describe("alerte de vacance", () => {
  it("signale chaque lot vacant", () => {
    const alerts = buildAlerts(assets, [], [], [
      {
        asset_id: ASSET_ID,
        area_sqm: 940,
        floor: "3e étage",
        vacant_since: "2026-03-01",
      },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "vacance", areaSqm: 940, floorLabel: "3e étage" });
  });
});
