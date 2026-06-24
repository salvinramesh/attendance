import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check matched users in 100-400 range
  const matchedUsers = await prisma.user.findMany({
    where: { id: { gte: 100, lte: 400 } },
    orderBy: { id: 'asc' },
    take: 30,
    select: { id: true, name: true, username: true }
  });
  console.log('Users with IDs 100-400 (matched employees):');
  console.log(JSON.stringify(matchedUsers, null, 2));

  // Check total user count
  const totalCount = await prisma.user.count();
  console.log(`\nTotal users: ${totalCount}`);

  // Check that no IDs are in temp ranges (20000+)
  const tempRangeCount = await prisma.user.count({ where: { id: { gte: 10000 } } });
  console.log(`Users in temp range (>=10000): ${tempRangeCount}`);

  // Check a few known matches
  const salvin = await prisma.user.findFirst({ where: { name: { contains: 'Salvin', mode: 'insensitive' } } });
  console.log(`\nSalvin (admin): ID=${salvin?.id}, name=${salvin?.name}`);
  
  const neethul = await prisma.user.findFirst({ where: { name: { contains: 'Neethul', mode: 'insensitive' } } });
  console.log(`Neethul: ID=${neethul?.id} (expected 181)`);
  
  const nithinU = await prisma.user.findFirst({ where: { name: { contains: 'Nithin U', mode: 'insensitive' } } });
  console.log(`Nithin U: ID=${nithinU?.id} (expected 102)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
