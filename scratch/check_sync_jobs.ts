import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking SyncJob Records ---');
  const jobs = await prisma.syncJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(jobs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
