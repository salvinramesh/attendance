import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Salvin Ramesh details ===');
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'Salvin Ramesh', mode: 'insensitive' } }
  });
  console.log('User:', user);

  if (user) {
    const enrollments = await prisma.deviceEnrollment.findMany({
      where: { userId: user.id }
    });
    console.log('Device Enrollments:', enrollments);

    const templates = await prisma.fingerprintTemplate.findMany({
      where: { userId: user.id }
    });
    console.log('Fingerprint Templates count:', templates.length);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
