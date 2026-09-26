import { UserDevice } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";

export class UserDeviceRepository {
  /**
   * Register or update a user device FCM push token.
   */
  async upsertDevice(data: {
    userId: string;
    token: string;
    platform: string;
    deviceId: string;
    deviceName?: string;
    appVersion?: string;
  }): Promise<UserDevice> {
    return prisma.$transaction(async (tx) => {
      // A provider token identifies exactly one installation. If the provider
      // rotates/reassigns it, move it instead of letting two users receive push.
      await tx.userDevice.deleteMany({
        where: {
          token: data.token,
          NOT: {
            userId: data.userId,
            deviceId: data.deviceId,
          },
        },
      });

      await tx.userDevice.updateMany({
        where: {
          deviceId: data.deviceId,
          userId: { not: data.userId },
          isActive: true,
        },
        data: { isActive: false },
      });

      return tx.userDevice.upsert({
        where: {
          userId_deviceId: {
            userId: data.userId,
            deviceId: data.deviceId,
          },
        },
        create: {
          userId: data.userId,
          token: data.token,
          platform: data.platform,
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          appVersion: data.appVersion,
          lastActiveAt: new Date(),
          isActive: true,
        },
        update: {
          token: data.token,
          platform: data.platform,
          deviceName: data.deviceName,
          appVersion: data.appVersion,
          lastActiveAt: new Date(),
          isActive: true,
        },
      });
    });
  }

  /**
   * Find active FCM tokens for a user.
   */
  async findActiveTokensByUserId(userId: string): Promise<string[]> {
    const devices = await prisma.userDevice.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: { token: true },
    });

    return devices.map((d) => d.token).filter(Boolean);
  }

  async findByUserId(userId: string): Promise<UserDevice[]> {
    return prisma.userDevice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Deactivate or delete invalid FCM tokens (e.g. unregistered / invalid token response from FCM).
   */
  async deactivateTokens(tokens: string[]): Promise<number> {
    if (!tokens.length) return 0;

    const result = await prisma.userDevice.updateMany({
      where: {
        token: { in: tokens },
      },
      data: {
        isActive: false,
      },
    });

    return result.count;
  }

  /**
   * Unregister/delete device by deviceId and userId.
   */
  async deleteByDeviceId(userId: string, deviceId: string): Promise<boolean> {
    try {
      await prisma.userDevice.delete({
        where: {
          userId_deviceId: {
            userId,
            deviceId,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async deactivateById(userId: string, id: string): Promise<boolean> {
    const result = await prisma.userDevice.updateMany({
      where: { id, userId },
      data: { isActive: false },
    });
    return result.count > 0;
  }

  /**
   * Clean up inactive devices untouched for more than 60 days.
   */
  async deleteOldInactiveDevices(days = 60): Promise<number> {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await prisma.userDevice.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: threshold },
      },
    });
    return result.count;
  }
}

export const userDeviceRepository = new UserDeviceRepository();
