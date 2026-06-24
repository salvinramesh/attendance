import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const balances = await prisma.leaveBalance.findMany({
    where: { year: 2026 },
    include: {
      user: {
        select: { username: true, name: true }
      }
    }
  });
  console.log('Balances:', balances);
}

main().catch(console.error).finally(() => prisma.$disconnect());
