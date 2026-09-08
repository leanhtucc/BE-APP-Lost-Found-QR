import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  fetchLostFeed: vi.fn(),
  countOwnLostItems: vi.fn(),
}));

vi.mock("./home.repository", () => repository);

import { homeService } from "./home.service";

const ownCard = {
  itemId: "own-lost",
  name: "Ví",
  category: "wallet",
  imagePublicUrl: null,
  lostMessage: null,
  distanceMeters: 500,
  distanceLabel: "500m",
  lostLat: 21,
  lostLng: 105,
  address: null,
  isOwn: true,
  ownerDisplayName: "Owner",
  ownerPhotoURL: null,
  reportedAt: "2026-09-08T00:00:00.000Z",
};

const nearbyCard = { ...ownCard, itemId: "nearby-lost", isOwn: false };

describe("HomeService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns only repository LOST rows and preserves global own count", async () => {
    repository.fetchLostFeed.mockResolvedValue({
      cards: [ownCard, nearbyCard],
      pins: [
        { itemId: ownCard.itemId, lat: 21, lng: 105, isOwn: true },
        { itemId: nearbyCard.itemId, lat: 21, lng: 105, isOwn: false },
      ],
    });
    repository.countOwnLostItems.mockResolvedValue(3);

    const result = await homeService.getLostFeed("owner-id", {
      lat: 21,
      lng: 105,
      radius: 10_000,
    });

    expect(result.cards.map((card) => card.itemId)).toEqual([
      "own-lost",
      "nearby-lost",
    ]);
    expect(result.myLostCount).toBe(3);
    expect(result.nearbyCount).toBe(1);
  });

  it("does not run an own-count query for guests", async () => {
    repository.fetchLostFeed.mockResolvedValue({
      cards: [nearbyCard],
      pins: [{ itemId: nearbyCard.itemId, lat: 21, lng: 105, isOwn: false }],
    });

    const result = await homeService.getLostFeed(undefined, {
      lat: 21,
      lng: 105,
      radius: 10_000,
    });

    expect(repository.countOwnLostItems).not.toHaveBeenCalled();
    expect(result.myLostCount).toBe(0);
    expect(result.nearbyCount).toBe(1);
  });
});
