import { describe, expect, it } from "vitest";

import { nextEventDate } from "@/lib/alerts";

const NOW = new Date(2026, 9, 25); // 25 octobre 2026

describe("règle de prochaine échéance", () => {
  it("retient la date à venir la plus proche parmi bail, sortie et prêt", () => {
    expect(
      nextEventDate(["2027-06-30", "2026-11-15", "2027-01-20", null, undefined], NOW),
    ).toBe("2026-11-15");
  });

  it("ignore les dates déjà passées", () => {
    expect(nextEventDate(["2025-03-01", "2026-02-28"], NOW)).toBeNull();
  });

  it("retient la date du jour", () => {
    expect(nextEventDate(["2026-10-25"], NOW)).toBe("2026-10-25");
  });

  it("renvoie null sans date", () => {
    expect(nextEventDate([], NOW)).toBeNull();
    expect(nextEventDate([null, undefined], NOW)).toBeNull();
  });
});
