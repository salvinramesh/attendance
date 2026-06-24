import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Updating user names to remove RIMS and RAMS ===');
  const users = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE'
    }
  });

  console.log(`Found ${users.length} users to inspect.`);

  let updatedCount = 0;
  for (const user of users) {
    let newName = user.name;
    if (newName.includes('(3F-RAMS)')) {
      newName = newName.replace('(3F-RAMS)', '(3F)').trim();
    } else if (newName.includes('(2F-RIMS)')) {
      newName = newName.replace('(2F-RIMS)', '(2F)').trim();
    }

    if (newName !== user.name) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: newName }
      });
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} users.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
