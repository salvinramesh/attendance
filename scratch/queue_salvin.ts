import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Queuing failed enrollments to PENDING ===');
  
  const updated = await prisma.deviceEnrollment.updateMany({
    where: {
      deviceId: '2',
      syncStatus: 'FAILED'
    },
    data: {
      syncStatus: 'PENDING',
      syncError: null
    }
  });
  
  console.log(`Updated ${updated.count} failed enrollments to PENDING.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
