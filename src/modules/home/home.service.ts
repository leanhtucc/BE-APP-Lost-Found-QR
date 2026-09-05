import { fetchLostFeed } from "./home.repository";
import { LostFeedQuery, LostFeedResponse } from "./home.types";

export class HomeService {
  async getLostFeed(
    userId: string | undefined,
    query: LostFeedQuery
  ): Promise<LostFeedResponse> {
    const { cards, pins } = await fetchLostFeed(userId, query);

    const myLostCount = cards.filter((c) => c.isOwn).length;
    const nearbyCount = cards.filter((c) => !c.isOwn).length;

    return { pins, cards, myLostCount, nearbyCount };
  }
}

export const homeService = new HomeService();
