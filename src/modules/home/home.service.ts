import { countOwnLostItems, fetchLostFeed } from "./home.repository";
import { LostFeedQuery, LostFeedResponse } from "./home.types";

export class HomeService {
  async getLostFeed(
    userId: string | undefined,
    query: LostFeedQuery
  ): Promise<LostFeedResponse> {
    const [lost, myLostCount] = await Promise.all([
      fetchLostFeed(userId, query),
      userId ? countOwnLostItems(userId) : Promise.resolve(0),
    ]);
    const nearbyCount = lost.cards.filter((card) => !card.isOwn).length;

    return { ...lost, myLostCount, nearbyCount };
  }
}

export const homeService = new HomeService();
