import { describe, expect, it } from "vitest";
import { createReportSchema } from "./report.schema";

describe("createReportSchema", () => {
  it("successfully parses valid mobile payload with snake_case and extra fields", () => {
    const payload = {
      body: {
        item_id: "clx_abc123",
        location: {
          lat: 21.0279,
          lng: 105.8412,
          address: "221B Baker St, Marylebone, London",
        },
        radar: {
          radius: 500,
          duration_hours: 24,
        },
        reward: {
          base_amount: 200000,
          is_custom: false,
        },
      },
    };

    const result = createReportSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("successfully parses valid mobile payload without address or null address", () => {
    const payload = {
      body: {
        item_id: "clx_abc123",
        location: {
          lat: 21.0279,
          lng: 105.8412,
          address: null,
        },
        radar: {
          radius: 500,
          duration_hours: 24,
        },
        reward: {
          base_amount: 100000,
        },
      },
    };

    const result = createReportSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("successfully parses camelCase payload aliases", () => {
    const payload = {
      body: {
        itemId: "clx_abc123",
        location: {
          lat: 21.0279,
          lng: 105.8412,
        },
        radar: {
          radius: 500,
          durationHours: 24,
        },
        reward: {
          baseAmount: 500000,
        },
      },
    };

    const result = createReportSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("fails when reward is below 10,000", () => {
    const payload = {
      body: {
        item_id: "clx_abc123",
        location: {
          lat: 21.0279,
          lng: 105.8412,
        },
        reward: {
          base_amount: 5000,
        },
      },
    };

    const result = createReportSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
