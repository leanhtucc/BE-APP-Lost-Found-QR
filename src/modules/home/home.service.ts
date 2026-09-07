import { fetchLostFeed } from "./home.repository";
import { getFoundFeed } from "../found-report/found-report.service";
import { LostFeedQuery, LostFeedResponse } from "./home.types";

export class HomeService {
  async getLostFeed(
    userId: string | undefined,
    query: LostFeedQuery
  ): Promise<LostFeedResponse> {
    const [lost, found] = await Promise.all([
      fetchLostFeed(userId, query),
      getFoundFeed(userId, query),
    ]);
    const cards = [
      ...found.filter((card) => card.isOwn),
      ...lost.cards,
      ...found.filter((card) => !card.isOwn),
    ];
    const pins = [
      ...lost.pins,
      ...found
        .filter((card) => card.lostLat != null && card.lostLng != null)
        .map((card) => ({
          itemId: card.itemId,
          lat: card.lostLat!,
          lng: card.lostLng!,
          isOwn: card.isOwn,
        })),
    ];

    const myLostCount = lost.cards.filter((c) => c.isOwn).length;
    const nearbyCount = cards.filter((c) => !c.isOwn).length;

    return { pins, cards, myLostCount, nearbyCount };
  }
}

export const homeService = new HomeService();
