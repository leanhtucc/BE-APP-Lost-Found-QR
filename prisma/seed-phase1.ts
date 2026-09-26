import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { ItemStatus } from "../src/generated/prisma/enums";
import { prisma } from "../src/libs/prisma";

const OWNER_UID = "phase1-acceptance-owner";
const OWNER_EMAIL = "phase1.owner@example.test";
const OWNER_PASSWORD = "Phase1Test!234";
const BASE_LAT = 21.0278;
const BASE_LNG = 105.8342;

const categories = [
  "electronics",
  "wallet",
  "keys",
  "bag",
  "documents",
  "jewelry",
  "phone",
  "other",
] as const;

const statuses = [
  ItemStatus.SAFE,
  ItemStatus.LOST,
  ItemStatus.FOUND,
  ItemStatus.RESOLVED,
] as const;

function assertDevelopmentEnvironment(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Phase 1 acceptance seed is disabled in production");
  }
}

async function main(): Promise<void> {
  assertDevelopmentEnvironment();
  const emptyOnly = process.argv.includes("--empty");
  const password = await bcrypt.hash(OWNER_PASSWORD, 12);

  const owner = await prisma.user.upsert({
    where: { uid: OWNER_UID },
    update: { displayName: "Phase 1 Owner", password, isVerified: true },
    create: {
      uid: OWNER_UID,
      email: OWNER_EMAIL,
      displayName: "Phase 1 Owner",
      password,
      isVerified: true,
    },
  });

  await prisma.item.deleteMany({ where: { ownerId: owner.id } });

  if (emptyOnly) {
    console.log(`Phase 1 empty scenario ready for ${OWNER_EMAIL}`);
    return;
  }

  for (let index = 0; index < 20; index += 1) {
    const status = statuses[index % statuses.length];
    const isLost = status === ItemStatus.LOST;
    const latitude = BASE_LAT + index * 0.00035;
    const longitude = BASE_LNG + index * 0.0003;
    const itemId = nanoid(16);
    const longText =
      index === 19
        ? "Mô tả nghiệm thu rất dài để kiểm tra khả năng xuống dòng, co giãn bố cục và khả năng đọc trên màn hình nhỏ 360dp mà không che các thao tác chính."
        : `Dữ liệu nghiệm thu Phase 1, trường hợp số ${index + 1}.`;

    await prisma.item.create({
      data: {
        ownerId: owner.id,
        itemId,
        qrCodeId: nanoid(16),
        securityToken: nanoid(32),
        name:
          index === 18
            ? "Tên món đồ rất dài dùng để xác minh giao diện không tràn trên thiết bị có chiều rộng 360dp"
            : `Món đồ nghiệm thu ${String(index + 1).padStart(2, "0")}`,
        category: categories[index % categories.length],
        description: longText,
        status,
        imagePublicUrl:
          index % 3 === 0
            ? null
            : `https://picsum.photos/seed/findback-phase1-${index + 1}/800/600`,
        lostMessage: isLost
          ? index === 17
            ? "Lời nhắn thất lạc dài để kiểm tra trình bày: vui lòng giữ món đồ ở nơi an toàn và liên hệ qua ứng dụng FindBack; không chia sẻ thông tin cá nhân ra bên ngoài."
            : "Vui lòng liên hệ qua FindBack nếu bạn tìm thấy món đồ này."
          : null,
        lostAddress: isLost
          ? index === 13
            ? "Một địa chỉ nghiệm thu rất dài, Phường Tràng Tiền, Quận Hoàn Kiếm, Thành phố Hà Nội"
            : "Hoàn Kiếm, Hà Nội"
          : null,
        lostLat: isLost ? latitude : null,
        lostLng: isLost ? longitude : null,
        latitude: isLost ? latitude : null,
        longitude: isLost ? longitude : null,
        locationUpdatedAt: isLost ? new Date() : null,
        captureLatitude: BASE_LAT,
        captureLongitude: BASE_LNG,
        captureAddress: "Hà Nội",
        capturedAt: new Date(),
        qrCodeUrl: `https://findback.vn/item/${itemId}`,
      },
    });
  }

  await prisma.$executeRaw`
    UPDATE "Item"
    SET "location" = ST_SetSRID(ST_MakePoint("lostLng", "lostLat"), 4326)::geography
    WHERE "ownerId" = ${owner.id}
      AND "lostLat" IS NOT NULL
      AND "lostLng" IS NOT NULL
  `;

  console.log(`Phase 1 acceptance data ready: 20 items for ${OWNER_EMAIL}`);
  console.log(`Development password: ${OWNER_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error("Phase 1 seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
