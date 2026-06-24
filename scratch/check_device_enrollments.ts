import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.deviceEnrollment.groupBy({
    by: ['deviceId', 'syncStatus'],
    _count: {
      id: true
    }
  });
  console.log('Enrollments Sync Status Breakdown:');
  console.log(result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
