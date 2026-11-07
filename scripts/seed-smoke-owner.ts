import { prisma } from "../src/libs/prisma";
import { hashPassword } from "../src/utils/hash";

async function main() {
  const email = "owner_smoke@test.findback.app";
  const password = "Password123!";
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      isVerified: true,
    },
    create: {
      email,
      password: hashedPassword,
      displayName: "Smoke Owner User",
      role: "user",
      isVerified: true,
      uid: "smoke_owner_uid",
    },
  });

  console.log("Smoke owner user ready:", user.id, user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
