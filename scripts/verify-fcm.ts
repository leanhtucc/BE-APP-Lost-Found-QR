import firebaseAdmin from "../src/config/firebaseAdmin";
import { prisma } from "../src/libs/prisma";

async function main(): Promise<void> {
  if (!firebaseAdmin.apps.length) {
    throw new Error("Firebase Admin is not initialized");
  }

  const accessToken = await firebaseAdmin.apps[0].options.credential.getAccessToken();
  if (!accessToken.access_token) {
    throw new Error("Firebase credential did not return an access token");
  }
  console.log("Firebase service-account credential verified");

  const device = await prisma.userDevice.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { token: true },
  });

  if (!device) {
    console.log("FCM device dry-run skipped: no active device token was found");
    return;
  }

  const messageId = await firebaseAdmin.messaging().send(
    {
      token: device.token,
      notification: {
        title: "FCM dry run",
        body: "Credential and device-token validation only",
      },
      data: {
        type: "SYSTEM",
        action: "NONE",
      },
    },
    true
  );

  console.log("FCM dry-run succeeded", { messageId });
}

main()
  .catch((error: unknown) => {
    console.error(
      "FCM dry-run failed",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
