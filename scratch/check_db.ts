import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const counts = await prisma.attendanceLog.groupBy({
    by: ['date'],
    _count: {
      id: true
    },
    orderBy: {
      date: 'desc'
    },
    take: 5
  });
  console.log('Last 5 days counts:');
  console.log(counts);
}
main();
