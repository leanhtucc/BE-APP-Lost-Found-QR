/**
 * Seed script: Creates fake lost items with real coordinates for testing the Live Radar feature
 * Usage: npx ts-node prisma/seed-radar.ts
 *
 * Items are spread across Ho Chi Minh City with varying distances from each other.
 */

import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

const TEST_USER_UID = "mock-owner-999";

const FAKE_ITEMS = [
  {
    name: "iPhone 14 Pro Max",
    category: "electronics",
    description: "Mau den, khong vo op",
    lostMessage: "De quen tren xe buyt tuyen 36, co dan sticker ten",
    imagePublicUrl: "https://picsum.photos/seed/iphone14/400/400",
    lostLat: 10.7769,
    lostLng: 106.7009,
    lostAddress: "Trạm xe buýt chợ Bến Thành, Quận 1",
  },
  {
    name: "Vi da nam Louis Vuitton",
    category: "accessories",
    description: "Vi mau nau, co the CCCD ben trong",
    lostMessage: "Danh roi gan quan ca phe goc duong Nguyen Hue",
    imagePublicUrl: "https://picsum.photos/seed/wallet/400/400",
    lostLat: 10.7731,
    lostLng: 106.703,
    lostAddress: "Góc đường Nguyễn Huệ, Quận 1",
  },
  {
    name: "Laptop Dell XPS 13",
    category: "electronics",
    description: "Mau bac, trong tui dung mau den",
    lostMessage: "Bo quen trong quan Highlands Coffee tang 1 Landmark 81",
    imagePublicUrl: "https://picsum.photos/seed/laptop/400/400",
    lostLat: 10.795,
    lostLng: 106.7218,
  },
  {
    name: "Chia khoa xe Honda Vision",
    category: "other",
    description: "Vong chia khoa hinh gau truc",
    lostMessage: "Danh roi dau do o khu vuc Bitexco",
    imagePublicUrl: "https://picsum.photos/seed/keys/400/400",
    lostLat: 10.7716,
    lostLng: 106.7043,
  },
  {
    name: "AirPods Pro Gen 2",
    category: "electronics",
    description: "Hop trang, co khac ten Minh o day",
    lostMessage: "De quen o cong vien 23/9",
    imagePublicUrl: "https://picsum.photos/seed/airpods/400/400",
    lostLat: 10.7677,
    lostLng: 106.6928,
  },
  {
    name: "Balo Herschel mau xanh",
    category: "bags",
    description: "Ben trong co laptop va tai lieu quan trong",
    lostMessage: "Bi lay nham o sieu thi Vinmart Q3",
    imagePublicUrl: "https://picsum.photos/seed/backpack/400/400",
    lostLat: 10.781,
    lostLng: 106.6942,
  },
  {
    name: "Kinh mat Rayban Wayfarer",
    category: "accessories",
    description: "Gong den, co bao da mau nau",
    lostMessage: "Rot tren xe Grab duong Dien Bien Phu",
    imagePublicUrl: "https://picsum.photos/seed/sunglasses/400/400",
    lostLat: 10.784,
    lostLng: 106.7092,
  },
  {
    name: "The sinh vien + The xe buyt",
    category: "documents",
    description: "De trong bao nhua trong suot",
    lostMessage: "Danh roi tai tram xe buyt Dai hoc Su pham",
    imagePublicUrl: "https://picsum.photos/seed/card/400/400",
    lostLat: 10.8082,
    lostLng: 106.714,
  },
];

async function main() {
  console.log("Starting radar seed...");

  let user = await prisma.user.findFirst({ where: { uid: TEST_USER_UID } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        uid: TEST_USER_UID,
        memberId: nanoid(10),
        displayName: "Test Radar User",
        email: "mock-owner-999@findback.app",
        photoURL: "https://i.pravatar.cc/150?u=test-radar",
        isVerified: true,
      } as any,
    });
    console.log("Created test user:", user.id);
  } else {
    console.log("Reusing existing test user:", user.id);
  }

  let created = 0;
  for (const item of FAKE_ITEMS) {
    const existing = await prisma.item.findFirst({
      where: { name: item.name, ownerId: user.id },
    });

    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data: {
          status: "LOST",
          lostLat: item.lostLat,
          lostLng: item.lostLng,
          lostAddress: item.lostAddress,
          lostMessage: item.lostMessage,
          imagePublicUrl: item.imagePublicUrl,
        },
      });
      console.log("Updated:", item.name);
    } else {
      const itemId = nanoid(16);
      await prisma.item.create({
        data: {
          itemId,
          ownerId: user.id,
          name: item.name,
          category: item.category,
          description: item.description,
          status: "LOST",
          lostMessage: item.lostMessage,
          imagePublicUrl: item.imagePublicUrl,
          lostLat: item.lostLat,
          lostLng: item.lostLng,
          lostAddress: item.lostAddress,
          securityToken: nanoid(32),
          qrCodeUrl: `https://findback.app/scan/${itemId}`,
        },
      });
      console.log("Created:", item.name);
      created++;
    }
  }

  console.log("Seed complete!", created, "new items created.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
