import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking User ===');
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: 10276 },
        { username: '201' },
        { name: { contains: 'Salvin' } }
      ]
    }
  });

  if (!user) {
    console.log('User not found!');
    return;
  }

  console.log('Found user:', user);

  console.log('\n=== Checking LeaveBalances ===');
  const balances = await prisma.leaveBalance.findMany({
    where: { userId: user.id }
  });
  console.log('LeaveBalances:', balances);

  console.log('\n=== Checking LeaveRecords ===');
  const records = await prisma.leaveRecord.findMany({
    where: { userId: user.id }
  });
  console.log(`Found ${records.length} leave records:`, records);
}

main().catch(console.error).finally(() => prisma.$disconnect());
