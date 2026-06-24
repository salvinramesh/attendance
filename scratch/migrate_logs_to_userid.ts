import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating attendance logs to userId...');

  // Fetch all enrollments to build a mapping cache
  const enrollments = await prisma.deviceEnrollment.findMany();
  // Map of deviceId__enrollId -> userId
  const enrollmentMap = new Map<string, number>();
  for (const e of enrollments) {
    enrollmentMap.set(`${e.deviceId}__${e.enrollId}`, e.userId);
  }

  // Fetch all attendance logs that don't have a userId yet
  const logs = await prisma.attendanceLog.findMany({
    where: { userId: null }
  });
  console.log(`Found ${logs.length} logs with null userId.`);

  let updatedCount = 0;
  const BATCH_SIZE = 1000;
  let batch = [];

  for (const log of logs) {
    const enrollId = (log.scannerUserId || log.enrollId || '').trim();
    if (!enrollId || !log.deviceId) continue;
    const key = `${log.deviceId}__${enrollId}`;
    let targetUserId = enrollmentMap.get(key);

    if (!targetUserId && log.deviceId === '1') {
      // Fallback for device 1: if there's no device enrollment but the enrollId is a valid User ID
      const empId = Number(enrollId);
      if (!isNaN(empId)) {
        const userExists = await prisma.user.findUnique({ where: { id: empId } });
        if (userExists) {
          targetUserId = empId;
        }
      }
    }

    if (targetUserId) {
      batch.push(
        prisma.attendanceLog.update({
          where: { id: log.id },
          data: { userId: targetUserId }
        })
      );
      
      if (batch.length >= BATCH_SIZE) {
        await prisma.$transaction(batch);
        updatedCount += batch.length;
        console.log(`Updated ${updatedCount}/${logs.length} logs...`);
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await prisma.$transaction(batch);
    updatedCount += batch.length;
  }

  console.log(`Successfully migrated ${updatedCount} logs to userId.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
