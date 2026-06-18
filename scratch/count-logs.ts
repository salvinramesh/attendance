import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  try {
    const userCount = await prisma.user.count();
    const logCount = await prisma.attendanceLog.count();
    console.log(`Connection successful!`);
    console.log(`User count: ${userCount}`);
    console.log(`AttendanceLog count: ${logCount}`);
    
    // Check some sample logs
    const sampleLogs = await prisma.attendanceLog.findMany({
      take: 5,
      orderBy: { id: 'desc' }
    });
    console.log('Sample logs:', JSON.stringify(sampleLogs, null, 2));
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
