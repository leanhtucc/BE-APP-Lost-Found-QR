import { ENV } from "../../config/env";
import { prisma } from "../../libs/prisma";
import { issueGuestToken } from "../../libs/guest-jwt";
import {
  createStreamUserToken,
  upsertStreamUser,
} from "../../libs/stream-chat";
import { AppError } from "../../middlewares/error.middleware";

const STREAM_TOKEN_TTL_SECONDS = 60 * 60;

async function getActiveGuest(id: string, returnSessionId: string) {
  const guest = await prisma.user.findUnique({ where: { id } });
  if (!guest || guest.role !== "guest" || guest.scheduledDeletionAt)
    throw new AppError("Guest account is not active", 401);
  const session = await prisma.returnSession.findUnique({
    where: { id: returnSessionId },
    select: { id: true, finderId: true, status: true },
  });
  if (
    !session ||
    session.finderId !== id ||
    session.status === "COMPLETED" ||
    session.status === "MEETUP_CANCELLED"
  )
    throw new AppError("Guest return session is not active", 403);
  return guest;
}

export class GuestService {
  async refresh(input: { id: string; returnSessionId: string; oiat: number }) {
    await getActiveGuest(input.id, input.returnSessionId);
    return issueGuestToken(input.id, input.returnSessionId, input.oiat);
  }

  async createStreamToken(input: { id: string; returnSessionId: string }) {
    const guest = await getActiveGuest(input.id, input.returnSessionId);
    const expiresAt = Math.floor(Date.now() / 1000) + STREAM_TOKEN_TTL_SECONDS;
    await upsertStreamUser({
      id: guest.id,
      name: guest.displayName || "Guest",
    });
    return {
      token: createStreamUserToken(guest.id, expiresAt),
      // Public client key (not the secret); the app needs it to connect.
      apiKey: ENV.STREAM_API_KEY,
      expiresAt,
      userId: guest.id,
    };
  }
}

export const guestService = new GuestService();
