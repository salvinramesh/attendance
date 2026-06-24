import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    where: {
      OR: [
        { username: '78-3f' },
        { name: { contains: 'Paulson', mode: 'insensitive' } }
      ]
    }
  });

  if (!u) {
    console.log('User Paulson not found');
    return;
  }

  console.log('User:', u);
  const de = await prisma.deviceEnrollment.findMany({ where: { userId: u.id } });
  console.log('DeviceEnrollments:', de);

  const logs = await prisma.attendanceLog.findMany({ where: { userId: u.id } });
  console.log('Logs count:', logs.length);

  const distinctMonths = Array.from(new Set(logs.map(x => x.date.substring(0, 7)))).sort();
  console.log('Distinct months:', distinctMonths);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    prisma.$disconnect().then(() => process.exit(1));
  });
