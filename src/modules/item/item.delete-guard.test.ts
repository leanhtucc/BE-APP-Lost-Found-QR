import { beforeEach, describe, expect, it, vi } from "vitest";

const { findByIdentifier, deleteItem, sessionCount } = vi.hoisted(() => ({
  findByIdentifier: vi.fn(),
  deleteItem: vi.fn(),
  sessionCount: vi.fn(),
}));

vi.mock("../../libs/prisma", () => ({
  prisma: { returnSession: { count: sessionCount } },
}));

vi.mock("./item.repository", () => ({
  ItemRepository: class {
    findByIdentifier = findByIdentifier;
    deleteItem = deleteItem;
  },
}));

import { ItemService } from "./item.service";

const service = new ItemService();

describe("itemService.deleteItem active return guard", () => {
  beforeEach(() => {
    findByIdentifier.mockReset();
    deleteItem.mockReset();
    sessionCount.mockReset();
  });

  it("rejects deleting an item with an unfinished return session", async () => {
    findByIdentifier.mockResolvedValue({ id: "i1", ownerId: "u1", status: "LOST" });
    sessionCount.mockResolvedValue(1);

    await expect(service.deleteItem("i1", "u1")).rejects.toMatchObject({
      statusCode: 409,
      code: "ITEM_HAS_ACTIVE_RETURN",
    });
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it("rejects deleting an item in FOUND status", async () => {
    findByIdentifier.mockResolvedValue({ id: "i1", ownerId: "u1", status: "FOUND" });
    sessionCount.mockResolvedValue(0);

    await expect(service.deleteItem("i1", "u1")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it("deletes a SAFE item with no open sessions", async () => {
    findByIdentifier.mockResolvedValue({ id: "i1", ownerId: "u1", status: "SAFE" });
    sessionCount.mockResolvedValue(0);

    await service.deleteItem("i1", "u1");
    expect(deleteItem).toHaveBeenCalledWith("i1");
  });
});
