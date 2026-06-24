import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sampleLogs = await prisma.attendanceLog.findMany({
    where: { userId: null },
    take: 10
  });
  console.log('Sample of 10 unmapped logs:');
  console.log(JSON.stringify(sampleLogs, null, 2));

  const sampleEnrollments = await prisma.deviceEnrollment.findMany({
    take: 10
  });
  console.log('Sample of 10 enrollments:');
  console.log(JSON.stringify(sampleEnrollments, null, 2));

  const totalLogs = await prisma.attendanceLog.count();
  const unmappedLogs = await prisma.attendanceLog.count({ where: { userId: null } });
  console.log(`Total logs: ${totalLogs}, Unmapped logs: ${unmappedLogs}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
