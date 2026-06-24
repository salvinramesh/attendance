import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking templates for Salvin Ramesh (User ID 201) ---');
  const templates = await prisma.fingerprintTemplate.findMany({
    where: { userId: 201 }
  });
  console.log(`Templates for User 201: ${templates.length}`);

  const totalTemplates = await prisma.fingerprintTemplate.count();
  console.log(`Total templates in database: ${totalTemplates}`);

  const usersWithTemplates = await prisma.fingerprintTemplate.groupBy({
    by: ['userId'],
    _count: {
      userId: true
    }
  });
  console.log('Users with templates in database count:', usersWithTemplates.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
