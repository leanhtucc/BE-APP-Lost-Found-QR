import { describe, expect, it } from "vitest";
import { parseItemChannelId } from "./item-channel-id";

describe("item channel ID resolution", () => {
  it("keeps QR code ID distinct from the internal item ID", () => {
    expect(parseItemChannelId("item_qr_public_789_finder123")).toEqual({
      qrCodeId: "qr_public_789",
      finderId: "finder123",
    });
  });

  it("rejects channel IDs without both identifiers", () => {
    expect(parseItemChannelId("item_only-one-id")).toBeNull();
  });
});
