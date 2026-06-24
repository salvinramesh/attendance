import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Starting Database Purge ===');

  console.log('Deleting AttendanceLogs...');
  await prisma.attendanceLog.deleteMany();

  console.log('Deleting WFHLogs...');
  await prisma.wFHLog.deleteMany();

  console.log('Deleting LeaveRecords...');
  await prisma.leaveRecord.deleteMany();

  console.log('Deleting LeaveBalances...');
  await prisma.leaveBalance.deleteMany();

  console.log('Deleting DeviceEnrollments...');
  await prisma.deviceEnrollment.deleteMany();

  console.log('Deleting FingerprintTemplates...');
  await prisma.fingerprintTemplate.deleteMany();

  console.log('Deleting Employees (Users where username !== admin)...');
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      username: {
        not: 'admin'
      }
    }
  });
  console.log(`Deleted ${deletedUsers.count} users.`);

  console.log('=== Database Purge Complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
