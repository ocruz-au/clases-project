import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

let prisma: PrismaClient;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env['DATABASE_URL_TEST'] } },
    });
  }
  return prisma;
}

export async function truncateAllTables(): Promise<void> {
  const db = getTestPrisma();
  await db.$transaction([
    db.processedWebhookEvent.deleteMany(),
    db.auditLog.deleteMany(),
    db.notification.deleteMany(),
    db.refund.deleteMany(),
    db.payment.deleteMany(),
    db.waitlistEntry.deleteMany(),
    db.seatHold.deleteMany(),
    db.booking.deleteMany(),
    db.classSession.deleteMany(),
    db.availabilityRule.deleteMany(),
    db.class.deleteMany(),
    db.category.deleteMany(),
    db.room.deleteMany(),
    db.location.deleteMany(),
    db.cancellationPolicy.deleteMany(),
    db.instructorProfile.deleteMany(),
    db.userRole.deleteMany(),
    db.user.deleteMany(),
    db.coupon.deleteMany(),
    db.setting.deleteMany(),
    db.review.deleteMany(),
  ]);
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) await prisma.$disconnect();
}
