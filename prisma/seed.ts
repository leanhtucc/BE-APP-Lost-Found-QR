import { nanoid } from "nanoid";
import { ItemStatus, PostStatus } from "../src/generated/prisma/enums";
import { prisma } from "../src/libs/prisma";

const owner = {
  uid: "seed-owner-hanoi",
  email: "owner@example.test",
  displayName: "Nguyễn Minh Anh",
  phoneNumber: "+84900000001",
  photoURL: "https://api.dicebear.com/9.x/avataaars/png?seed=MinhAnh",
};

const mapUsers = [
  {
    uid: "seed-map-hoan-kiem",
    email: "map.hoankiem@example.test",
    displayName: "Trần Hoàng",
    lat: 21.0285,
    lng: 105.8542,
  },
  {
    uid: "seed-map-hai-ba-trung",
    email: "map.hbt@example.test",
    displayName: "Lê Hà",
    lat: 21.0157,
    lng: 105.8414,
  },
  {
    uid: "seed-map-cau-giay",
    email: "map.caugiay@example.test",
    displayName: "Phạm Nam",
    lat: 21.0376,
    lng: 105.781,
  },
];

const items = [
  {
    name: "iPhone 15 Pro Max",
    category: "electronics",
    description: "Màu titan xanh, ốp lưng trong suốt.",
    lostMessage: "Làm rơi gần thư viện Đại học Bách Khoa Hà Nội.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1592286927505-2fd0dc900a12",
    lostLat: 21.0077,
    lostLng: 105.8434,
    lostAddress: "Đại học Bách Khoa Hà Nội",
    bountyAmount: 1_000_000,
  },
  {
    name: "MacBook Pro 14 inch",
    category: "electronics",
    description: "MacBook Pro màu Space Gray, có sticker Apple trắng.",
    lostMessage: "Để quên ở quán cà phê trên phố Bà Triệu.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    lostLat: 21.0186,
    lostLng: 105.8482,
    lostAddress: "Phố Bà Triệu, Hai Bà Trưng, Hà Nội",
    bountyAmount: 1_500_000,
  },
  {
    name: "Chó Corgi tên Lucky",
    category: "pets",
    description: "Corgi lông vàng, đeo vòng cổ màu đỏ.",
    lostMessage: "Thất lạc ở công viên Thống Nhất.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1612536616558-c2c8ab3e1f3e",
    lostLat: 21.0157,
    lostLng: 105.8414,
    lostAddress: "Công viên Thống Nhất, Hà Nội",
    bountyAmount: 800_000,
  },
  {
    name: "Ví da màu nâu",
    category: "wallet",
    description: "Ví nam màu nâu, bên trong có giấy tờ tùy thân.",
    lostMessage: "Làm rơi khi di chuyển quanh hồ Hoàn Kiếm.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1627123424574-724758594e93",
    lostLat: 21.0279,
    lostLng: 105.8524,
    lostAddress: "Hồ Hoàn Kiếm, Hà Nội",
    bountyAmount: 500_000,
  },
  {
    name: "Chìa khóa xe Honda SH",
    category: "keys",
    description: "Smartkey Honda có móc khóa hình gấu.",
    lostMessage: "Làm rơi tại bãi xe Vincom Trần Duy Hưng.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1582139329536-e7284fece509",
    lostLat: 21.0071,
    lostLng: 105.8018,
    lostAddress: "Vincom Trần Duy Hưng, Cầu Giấy, Hà Nội",
    bountyAmount: 300_000,
  },
  {
    name: "Thẻ sinh viên",
    category: "documents",
    description: "Thẻ sinh viên để trong bao nhựa trong suốt.",
    lostMessage: "Đánh rơi gần Đại học Quốc gia Hà Nội.",
    imagePublicUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d",
    lostLat: 21.0376,
    lostLng: 105.781,
    lostAddress: "Đại học Quốc gia Hà Nội, Cầu Giấy",
    bountyAmount: 200_000,
  },
  {
    name: "Balo Adidas màu đen",
    category: "bags",
    description: "Balo ba sọc trắng, bên trong có sách và sạc laptop.",
    lostMessage: "Để quên trên xe buýt tuyến 32.",
    imagePublicUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62",
    lostLat: 21.0285,
    lostLng: 105.8542,
    lostAddress: "Khu vực Nhà hát Lớn Hà Nội",
    bountyAmount: 400_000,
  },
  {
    name: "Vòng tay Pandora",
    category: "jewelry",
    description: "Vòng bạc có charm hình trái tim và ngôi sao.",
    lostMessage: "Làm rơi khi đi bộ quanh Hồ Tây.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f",
    lostLat: 21.0478,
    lostLng: 105.8213,
    lostAddress: "Hồ Tây, Hà Nội",
    bountyAmount: 700_000,
  },
  {
    name: "iPad Pro 12.9 inch",
    category: "electronics",
    description: "iPad màu bạc, kèm Apple Pencil và ốp xanh.",
    lostMessage: "Để quên tại quán cà phê trong Lotte Center.",
    imagePublicUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
    lostLat: 21.0338,
    lostLng: 105.8133,
    lostAddress: "Lotte Center Liễu Giai, Hà Nội",
    bountyAmount: 1_200_000,
  },
  {
    name: "Mèo Anh lông ngắn tên Miu",
    category: "pets",
    description: "Mèo lông xám, mắt vàng, đeo vòng cổ hồng.",
    lostMessage: "Thất lạc gần khu đô thị Times City.",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1574158622682-e40e69881006",
    lostLat: 20.9958,
    lostLng: 105.8692,
    lostAddress: "Times City, Hai Bà Trưng, Hà Nội",
    bountyAmount: 600_000,
  },
];

async function clearDatabase() {
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.escrowTransaction.deleteMany();
  await prisma.post.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userLocation.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Resetting database and creating fake Hanoi map data...");
  await clearDatabase();

  const createdOwner = await prisma.user.create({
    data: {
      ...owner,
      isVerified: true,
      role: "user",
    },
  });

  for (const fakeUser of mapUsers) {
    const user = await prisma.user.create({
      data: {
        uid: fakeUser.uid,
        email: fakeUser.email,
        displayName: fakeUser.displayName,
        isVerified: true,
      },
    });

    await prisma.userLocation.create({
      data: {
        userId: user.id,
        lat: fakeUser.lat,
        lng: fakeUser.lng,
      },
    });
  }

  for (const [index, fakeItem] of items.entries()) {
    const itemId = nanoid(16);
    const createdItem = await prisma.item.create({
      data: {
        itemId,
        qrCodeId: nanoid(16),
        ownerId: createdOwner.id,
        name: fakeItem.name,
        category: fakeItem.category,
        description: fakeItem.description,
        status: ItemStatus.LOST,
        lostMessage: fakeItem.lostMessage,
        imagePublicUrl: fakeItem.imagePublicUrl,
        lostLat: fakeItem.lostLat,
        lostLng: fakeItem.lostLng,
        lostAddress: fakeItem.lostAddress,
        latitude: fakeItem.lostLat,
        longitude: fakeItem.lostLng,
        locationUpdatedAt: new Date(),
        securityToken: nanoid(32),
        qrCodeUrl: `https://findback.app/scan/${itemId}`,
        hasInsurance: index < 2,
        details: { source: "seed", color: "N/A" },
      },
    });

    await prisma.post.create({
      data: {
        ownerId: createdOwner.id,
        itemId: createdItem.id,
        lat: fakeItem.lostLat,
        lng: fakeItem.lostLng,
        address: fakeItem.lostAddress,
        bountyAmount: fakeItem.bountyAmount,
        status: PostStatus.SEARCHING,
        description: fakeItem.lostMessage,
        radarConfig: { radius: 5000, durationHours: 72 },
      },
    });
  }

  await prisma.$executeRaw`
    UPDATE "Item"
    SET "location" = ST_SetSRID(ST_MakePoint("lostLng", "lostLat"), 4326)::geography
    WHERE "lostLat" IS NOT NULL AND "lostLng" IS NOT NULL
  `;

  console.log(
    `Seed complete: ${items.length} lost items, ${items.length} searching posts, ${mapUsers.length} active map users.`
  );
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
