import { describe, expect, it } from "vitest";

import { DOCUMENT_DOWNLOAD_TTL_SECONDS, PHOTO_TTL_SECONDS } from "@/lib/storage-ttl";

describe("durée de validité des liens privés signés", () => {
  it("limite le lien de téléchargement d'un document à 20 secondes", () => {
    expect(DOCUMENT_DOWNLOAD_TTL_SECONDS).toBe(20);
  });

  it("limite le lien de la photo à 10 minutes", () => {
    expect(PHOTO_TTL_SECONDS).toBe(600);
  });
});
