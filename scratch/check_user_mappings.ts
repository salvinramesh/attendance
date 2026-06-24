import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- User Search ---');
  const arun = await prisma.user.findFirst({
    where: { name: { contains: 'Arun Shaji', mode: 'insensitive' } }
  });
  console.log('Arun Shaji in User table:', arun);

  const neeraj = await prisma.user.findFirst({
    where: { name: { contains: 'Neeraj', mode: 'insensitive' } }
  });
  console.log('Neeraj in User table:', neeraj);

  console.log('\n--- Specific ID Query ---');
  const user293 = await prisma.user.findUnique({ where: { id: 293 } });
  console.log('User with ID 293:', user293);

  const user191 = await prisma.user.findUnique({ where: { id: 191 } });
  console.log('User with ID 191:', user191);

  console.log('\n--- Device Enrollment Search ---');
  const enrollmentsFor5 = await prisma.deviceEnrollment.findMany({
    where: { enrollId: '5' }
  });
  console.log('Device Enrollments with enrollId = 5:', enrollmentsFor5);

  const enrollmentsFor293 = await prisma.deviceEnrollment.findMany({
    where: { userId: 293 }
  });
  console.log('Device Enrollments for userId = 293:', enrollmentsFor293);

  // Let's also check if there is any user containing "Arun" in the database
  const anyArun = await prisma.user.findMany({
    where: { name: { contains: 'Arun', mode: 'insensitive' } }
  });
  console.log('Any user containing "Arun":', anyArun);

  console.log('\n--- Attendance Logs Summary for these users ---');
  if (arun) {
    const arunLogsCount = await prisma.attendanceLog.count({ where: { user: { id: arun.id } } });
    console.log(`Logs count for ${arun.name} (User ID ${arun.id}): ${arunLogsCount}`);
  }
  if (neeraj) {
    const neerajLogsCount = await prisma.attendanceLog.count({ where: { user: { id: neeraj.id } } });
    console.log(`Logs count for ${neeraj.name} (User ID ${neeraj.id}): ${neerajLogsCount}`);
  }

  // Also check logs with enrollId = '5' for deviceId = '2'
  const logCount5Device2 = await prisma.attendanceLog.count({
    where: { enrollId: '5', deviceId: '2' }
  });
  console.log(`Attendance logs count with enrollId = 5 on Device '2': ${logCount5Device2}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
