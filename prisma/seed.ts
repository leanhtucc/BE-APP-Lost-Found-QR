import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

const categories = [
  "tech",
  "pets",
  "wallet",
  "audio",
  "keys",
  "documents",
  "jewelry",
  "bags",
  "watches",
];

const items = [
  {
    name: "iPhone 15 Pro Max",
    category: "tech",
    description: "Màu titan xanh, có ốp lưng trong suốt, dán kính cường lực",
    status: "lost",
    lostMessage:
      "Mình làm rơi điện thoại ở khu vực thư viện trường, rất cần gấp vì có dữ liệu quan trọng. Xin hậu tạ!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1592286927505-2fd0dc900a12",
    lostLat: 21.0077,
    lostLng: 105.8434,
    lostAddress: "Khu vực thư viện ĐH Bách Khoa Hà Nội",
    securityPin: "1234",
  },
  {
    name: "MacBook Pro 14 inch",
    category: "tech",
    description:
      "MacBook Pro M3, màu Space Gray, có sticker Apple trắng sau lưng",
    status: "lost",
    lostMessage:
      "Để quên laptop ở quán cafe phố Bà Triệu. Có toàn bộ công việc quan trọng bên trong!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8",
    lostLat: 21.0186,
    lostLng: 105.8482,
    lostAddress: "Phố Bà Triệu, Hai Bà Trưng, Hà Nội",
    securityPin: "5678",
  },
  {
    name: "Tai nghe AirPods Pro 2",
    category: "audio",
    description: "AirPods Pro thế hệ 2, hộp có khắc tên 'Minh Tuấn' phía sau",
    status: "safe",
    lostMessage: null,
    imagePublicUrl:
      "https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7",
    securityPin: null,
  },
  {
    name: "Chó Corgi 6 tháng tuổi",
    category: "pets",
    description:
      "Chó Corgi lông vàng, đeo vòng cổ màu đỏ có tên 'Lucky', rất thân thiện",
    status: "lost",
    lostMessage:
      "Bé Lucky bị thất lạc ở công viên Thống Nhất chiều hôm qua. Gia đình rất lo lắng, mong mọi người giúp đỡ!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1612536616558-c2c8ab3e1f3e",
    lostLat: 21.0157,
    lostLng: 105.8414,
    lostAddress: "Công viên Thống Nhất, Hai Bà Trưng, Hà Nội",
    securityPin: "0000",
  },
  {
    name: "Ví da Louis Vuitton",
    category: "wallet",
    description:
      "Ví nam màu nâu, bên trong có CMND, thẻ ATM và một số tiền mặt",
    status: "lost",
    lostMessage:
      "Làm rơi ví khi đi taxi từ Hoàn Kiếm về Cầu Giấy. Bên trong có giấy tờ quan trọng, mong người nhặt được liên hệ!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1627123424574-724758594e93",
    lostLat: 21.0279,
    lostLng: 105.8524,
    lostAddress: "Hoàn Kiếm, Hà Nội",
    securityPin: "9999",
  },
  {
    name: "Chìa khóa xe SH 2023",
    category: "keys",
    description: "Chìa khóa smartkey Honda SH màu đỏ, có móc khóa hình con gấu",
    status: "lost",
    lostMessage:
      "Làm rơi chìa khóa xe ở bãi giữ xe Vincom Trần Duy Hưng. Không có chìa dự phòng, rất cần gấp!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1582139329536-e7284fece509",
    lostLat: 21.0071,
    lostLng: 105.8018,
    lostAddress: "Vincom Trần Duy Hưng, Cầu Giấy, Hà Nội",
    securityPin: "2468",
  },
  {
    name: "Thẻ sinh viên ĐH Bách Khoa",
    category: "documents",
    description: "Thẻ sinh viên có ảnh, tên Nguyễn Văn A, MSV: 2012345",
    status: "lost",
    lostMessage:
      "Mất thẻ sinh viên khi đi thi cuối kỳ. Đang cần gấp để thi các môn tiếp theo. Xin cảm ơn!",
    imagePublicUrl: "https://images.unsplash.com/photo-1553729459-efe14ef6055d",
    lostLat: 21.0376,
    lostLng: 105.781,
    lostAddress: "Đại học Quốc gia, Cầu Giấy, Hà Nội",
    securityPin: "1357",
  },
  {
    name: "Apple Watch Series 9",
    category: "watches",
    description:
      "Apple Watch màu đen, dây cao su xanh navy, có khắc tên sau lưng",
    status: "safe",
    lostMessage: null,
    imagePublicUrl:
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a",
    securityPin: null,
  },
  {
    name: "Balo Adidas màu đen",
    category: "bags",
    description: "Balo Adidas 3 sọc trắng, bên trong có laptop và sách vở",
    status: "lost",
    lostMessage:
      "Để quên balo trên xe bus tuyến 32. Bên trong có laptop và tài liệu quan trọng!",
    imagePublicUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62",
    lostLat: 21.0285,
    lostLng: 105.8542,
    lostAddress: "Xe bus tuyến 32, Hà Nội",
    securityPin: "7890",
  },
  {
    name: "Sony WH-1000XM5",
    category: "audio",
    description: "Tai nghe chụp tai Sony màu bạc, có hộp đựng màu đen",
    status: "safe",
    lostMessage: null,
    imagePublicUrl:
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb",
    securityPin: null,
  },
  {
    name: "Vòng tay Pandora",
    category: "jewelry",
    description:
      "Vòng tay bạc có charm hình trái tim và ngôi sao, rất có ý nghĩa",
    status: "lost",
    lostMessage:
      "Vòng tay này là quà sinh nhật từ người yêu, mình làm rơi ở Hồ Tây. Mong được tìm lại!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f",
    lostLat: 21.0478,
    lostLng: 105.8213,
    lostAddress: "Hồ Tây, Hà Nội",
    securityPin: "1111",
  },
  {
    name: "Passport Việt Nam",
    category: "documents",
    description: "Hộ chiếu Việt Nam, tên Trần Thị B, còn hạn đến 2028",
    status: "lost",
    lostMessage:
      "Làm rơi hộ chiếu ở sân bay Nội Bài. Sắp có chuyến bay, rất gấp! Xin hậu tạ hậu hĩnh!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec",
    lostLat: 21.2187,
    lostLng: 105.8042,
    lostAddress: "Sân bay Nội Bài, Hà Nội",
    securityPin: "2222",
  },
  {
    name: "iPad Pro 12.9 inch",
    category: "tech",
    description:
      "iPad Pro màu bạc, có Apple Pencil 2, ốp lưng Smart Folio xanh dương",
    status: "lost",
    lostMessage:
      "Để quên iPad tại quán Highlands Coffee Lotte Liễu Giai. Có dự án quan trọng chưa backup!",
    imagePublicUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
    lostLat: 21.0338,
    lostLng: 105.8133,
    lostAddress: "Lotte Center Liễu Giai, Ba Đình, Hà Nội",
    securityPin: "3333",
  },
  {
    name: "Mèo Anh lông ngắn",
    category: "pets",
    description: "Mèo Anh lông xám xanh, mắt vàng, đeo vòng cổ hồng có chuông",
    status: "lost",
    lostMessage:
      "Bé mèo tên Miu bị lạc gần khu vực Times City. Rất nhút nhát, mong được giúp đỡ!",
    imagePublicUrl:
      "https://images.unsplash.com/photo-1574158622682-e40e69881006",
    lostLat: 20.9958,
    lostLng: 105.8692,
    lostAddress: "Khu đô thị Times City, Hai Bà Trưng, Hà Nội",
    securityPin: "4444",
  },
  {
    name: "Samsung Galaxy Buds 2 Pro",
    category: "audio",
    description:
      "Tai nghe true wireless màu trắng, hộp sạc có vết xước nhỏ ở mặt trước",
    status: "safe",
    lostMessage: null,
    imagePublicUrl:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df",
    securityPin: null,
  },
];

async function main() {
  console.log("🌱 Starting seed...");

  // Lấy user đầu tiên để gán làm owner, nếu không có thì tự tạo 1 Dummy User
  let user = await prisma.user.findFirst();

  if (!user) {
    console.log("⚠️ No user found! Creating a default user...");
    user = await prisma.user.create({
      data: {
        id: "dummy_user_123",
        uid: "firebase_dummy_uid",
        email: "dummySeed@gmail.com",
        displayName: "Guardian Bot",
        photoURL: "https://api.dicebear.com/7.x/avataaars/png?seed=Guardian",
      }
    });
  }

  console.log(`✅ Found user: ${user.email}`);

  // Xóa các items cũ (optional)
  await prisma.item.deleteMany({});
  console.log("🗑️  Cleared old items");

  // Tạo fake items
  for (const itemData of items) {
    const qtyId = nanoid(16);
    const securityToken = nanoid(32);

    await prisma.item.create({
      data: {
        qrCodeId: qtyId,
        securityToken,
        ownerId: user.id,
        name: itemData.name,
        category: itemData.category,
        status: itemData.status.toUpperCase(),
        lostMessage: itemData.lostMessage,
        imagePublicUrl: itemData.imagePublicUrl,
        lostLat: itemData.lostLat,
        lostLng: itemData.lostLng,
        lostAddress: itemData.lostAddress,
        hasInsurance: itemData.name.includes("iPhone"),
        details: {
          description: itemData.description,
          securityPin: itemData.securityPin,
          color: "N/A"
        }
      },
    });

    console.log(`✅ Created item: ${itemData.name}`);
  }

  console.log(`\n🎉 Seed completed! Created ${items.length} items`);
  console.log(`\n📊 Test pagination:`);
  console.log(`   GET /api/items?page=1&limit=5`);
  console.log(`   GET /api/items?page=2&limit=5`);
  console.log(`   GET /api/items?status=lost&page=1&limit=5`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
