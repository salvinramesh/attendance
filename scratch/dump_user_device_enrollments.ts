import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    include: {
      deviceEnrollments: true
    }
  });

  console.log(`Loaded ${users.length} employees.\n`);

  // Let's filter those who have multiple enrollments or have deviceId = 2 with errors
  for (const u of users) {
    const hasD2 = u.deviceEnrollments.some(e => e.deviceId === '2');
    if (hasD2) {
      console.log(`User: ${u.name} (ID: ${u.id}, enrollId: ${u.enrollId})`);
      for (const e of u.deviceEnrollments) {
        console.log(`  Device: ${e.deviceId}, EnrollID: ${e.enrollId}, Status: ${e.syncStatus}, Error: ${e.syncError || 'None'}`);
      }
      console.log('-------------------------------');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
