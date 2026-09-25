import { nanoid } from "nanoid";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../libs/prisma";
import { createReturnChannel, upsertStreamUser } from "../../libs/stream-chat";

const userSelect = {
  id: true,
  displayName: true,
  email: true,
  photoURL: true,
} as const;

export async function createLostItemReturnChannel(
  authenticatedUserId: string,
  itemReference: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: {
        OR: [
          { id: itemReference },
          { itemId: itemReference },
          { qrCodeId: itemReference },
        ],
      },
      include: { owner: { select: userSelect } },
    });
    if (!item)
      throw new AppError("Item not found", 404, true, "ITEM_NOT_FOUND");
    if (item.ownerId === authenticatedUserId) {
      throw new AppError(
        "Owner cannot claim their own item",
        409,
        true,
        "INVALID_RETURN_PARTICIPANT"
      );
    }

    const existing = await tx.returnSession.findFirst({
      where: { itemId: item.id, finderId: authenticatedUserId },
    });
    if (existing) return { item, session: existing };
    if (item.status !== "LOST") {
      throw new AppError(
        "Item is no longer available",
        409,
        true,
        "ITEM_NOT_AVAILABLE"
      );
    }

    const claimed = await tx.item.updateMany({
      where: { id: item.id, status: "LOST" },
      data: { status: "FOUND" },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        "Item is no longer available",
        409,
        true,
        "ITEM_NOT_AVAILABLE"
      );
    }
    const report = await tx.post.findFirst({
      where: {
        itemId: item.id,
        status: { in: ["ACTIVE", "PENDING_PAYMENT", "FOUND"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (report) {
      await tx.post.update({
        where: { id: report.id },
        data: { status: "FOUND" },
      });
    }
    const sessionId = `ret_${nanoid(18)}`;
    const session = await tx.returnSession.create({
      data: {
        id: sessionId,
        channelId: `return_${sessionId}`,
        itemId: item.id,
        reportId: report?.id ?? null,
        ownerId: item.ownerId,
        finderId: authenticatedUserId,
      },
    });
    return { item, session };
  });

  const finder = await prisma.user.findUnique({
    where: { id: authenticatedUserId },
    select: userSelect,
  });
  if (!finder) throw new AppError("Finder not found", 404);
  await Promise.all([
    upsertStreamUser({
      id: result.item.owner.id,
      name: result.item.owner.displayName,
      email: result.item.owner.email,
      image: result.item.owner.photoURL || "",
    }),
    upsertStreamUser({
      id: finder.id,
      name: finder.displayName,
      email: finder.email,
      image: finder.photoURL || "",
    }),
  ]);
  const channel = await createReturnChannel({
    channelId: result.session.channelId,
    sourceType: "ITEM",
    sourceId: result.item.id,
    subjectName: result.item.name,
    ownerId: result.item.ownerId,
    finderId: authenticatedUserId,
  });
  return {
    channel,
    itemName: result.item.name,
    returnSessionId: result.session.id,
  };
}
