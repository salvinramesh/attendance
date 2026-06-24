import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const enrollments = await prisma.deviceEnrollment.findMany({
    where: {
      deviceId: '2',
      syncStatus: { in: ['FAILED', 'PENDING'] }
    },
    include: {
      user: true
    },
    orderBy: {
      syncStatus: 'asc'
    }
  });

  console.log(`Found ${enrollments.length} non-synced Device 2 enrollments:\n`);
  for (const e of enrollments) {
    console.log(`User: ${e.user.name} (ID: ${e.userId})`);
    console.log(`  Device 2 DIN: ${e.enrollId}`);
    console.log(`  Status: ${e.syncStatus}`);
    console.log(`  Error: ${e.syncError || 'None'}`);
    console.log('-----------------------------------');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
