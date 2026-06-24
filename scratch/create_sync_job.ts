import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const jobId = 'job-' + Date.now();
  console.log(`Creating pending SyncJob: ${jobId}`);
  
  const newJob = await prisma.syncJob.create({
    data: {
      id: jobId,
      status: 'PENDING',
      rangeType: 'beginning',
    }
  });
  
  console.log('Successfully created sync job:', newJob);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
