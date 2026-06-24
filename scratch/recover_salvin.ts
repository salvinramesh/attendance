import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Restoring Salvin (2F) from temp profile...');
  
  // Find any employee with name "Salvin (2F)" or username "27-2f" that is not the main user
  const tempUser = await prisma.user.findFirst({
    where: { username: '27-2f' }
  });
  
  if (!tempUser) {
    console.log('No temp user found with username "27-2f".');
    return;
  }

  console.log(`Found temp user with ID: ${tempUser.id}`);
  
  await prisma.$transaction(async (tx) => {
    // 1. Rename username to avoid conflict
    await tx.user.update({
      where: { id: tempUser.id },
      data: { username: '27-2f-temp' }
    });

    // 2. Recreate user 10276
    await tx.user.create({
      data: {
        id: 10276,
        username: '27-2f',
        password: '$2b$10$PRMpY0KsIhoAtGpUPlJ4HePgs1DmdPmdcABRcrMh5WLfo2rlrYcoy',
        name: '27 (2F)',
        role: 'EMPLOYEE',
        enrollId: '27 (2F)',
        dept: 'afi3'
      }
    });

    // 3. Move enrollment back to 10276
    await tx.deviceEnrollment.update({
      where: { id: 7343 },
      data: { userId: 10276 }
    });

    // 4. Move logs back to 10276
    await tx.attendanceLog.updateMany({
      where: { userId: tempUser.id },
      data: { userId: 10276, name: '27 (2F)', dept: 'afi3' }
    });

    // 5. Now delete temp user
    await tx.user.delete({
      where: { id: tempUser.id }
    });
  });

  console.log('Recovery complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
