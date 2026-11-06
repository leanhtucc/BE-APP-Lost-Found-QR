import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, tx } = vi.hoisted(() => {
  const updateMany = vi.fn();
  const tx = {
    item: { updateMany, findUnique: vi.fn() },
    post: { findFirst: vi.fn(), update: vi.fn() },
    payment: { updateMany: vi.fn() },
    escrowTransaction: { updateMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  return { updateMany, tx };
});

vi.mock("../../libs/prisma", () => ({
  prisma: {
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  },
}));

import { ItemRepository } from "./item.repository";

const itemRepository = new ItemRepository();

describe("itemRepository.markSafe transition guard", () => {
  beforeEach(() => {
    updateMany.mockReset();
    tx.post.findFirst.mockReset();
  });

  it("only transitions an item that is currently LOST", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await itemRepository.markSafe("item-1", "owner-1");

    const where = updateMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({
      id: "item-1",
      ownerId: "owner-1",
      status: "LOST",
    });
  });

  it.each(["FOUND", "RESOLVED", "SAFE"])(
    "returns null and touches nothing else when the item is %s",
    async () => {
      // updateMany matches no row because the where clause requires LOST.
      updateMany.mockResolvedValue({ count: 0 });

      const result = await itemRepository.markSafe("item-1", "owner-1");

      expect(result).toBeNull();
      expect(tx.post.findFirst).not.toHaveBeenCalled();
      expect(tx.escrowTransaction.updateMany).not.toHaveBeenCalled();
    }
  );
});
