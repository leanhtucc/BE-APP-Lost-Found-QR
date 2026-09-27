import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8"
);

describe("item identifier schema contract", () => {
  it("keeps the internal Item.id as the primary unique key", () => {
    expect(schema).toMatch(
      /model Item \{[\s\S]*?\bid\s+String\s+@id\s+@default\(cuid\(\)\)/
    );
  });

  it("keeps itemId and qrCodeId independently unique", () => {
    const itemModel = schema.match(/model Item \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(itemModel).toMatch(/\bitemId\s+String\s+@unique/);
    expect(itemModel).toMatch(/\bqrCodeId\s+String\s+@unique/);
    expect(itemModel).toMatch(/\bsecurityToken\s+String\s+@unique/);
  });
});
