import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== Starting DB Actions Integration Test ===');

  // 1. Locate the source and target users
  const sourceUser = await prisma.user.findFirst({
    where: { username: '27-2f' }
  });
  const targetUser = await prisma.user.findFirst({
    where: { username: '27-3f' }
  });

  if (!sourceUser || !targetUser) {
    console.error('Test skipped: Jithin/Salvin users not found in database.');
    return;
  }

  console.log(`Found Source User: ${sourceUser.name} (ID: ${sourceUser.id})`);
  console.log(`Found Target User: ${targetUser.name} (ID: ${targetUser.id})`);

  // Count logs before merge
  const sourceLogsCountBefore = await prisma.attendanceLog.count({ where: { userId: sourceUser.id } });
  const targetLogsCountBefore = await prisma.attendanceLog.count({ where: { userId: targetUser.id } });
  console.log(`Logs before merge -> Source: ${sourceLogsCountBefore}, Target: ${targetLogsCountBefore}`);

  const sId = sourceUser.id;
  const tId = targetUser.id;

  // 2. Perform the MERGE transaction (copied from route.ts)
  console.log('Executing Merge Transaction...');
  await prisma.$transaction(async (tx) => {
    // Move/Merge DeviceEnrollments
    const sourceEnrollments = await tx.deviceEnrollment.findMany({ where: { userId: sId } });
    const targetEnrollments = await tx.deviceEnrollment.findMany({ where: { userId: tId } });

    for (const se of sourceEnrollments) {
      const hasConflict = targetEnrollments.some(
        (te) => te.deviceId === se.deviceId && te.enrollId === se.enrollId
      );
      if (hasConflict) {
        await tx.deviceEnrollment.delete({ where: { id: se.id } });
      } else {
        await tx.deviceEnrollment.update({
          where: { id: se.id },
          data: { userId: tId }
        });
      }
    }

    // Move WFH logs
    await tx.wFHLog.updateMany({
      where: { userId: sId },
      data: { userId: tId }
    });

    // Move Attendance logs
    await tx.attendanceLog.updateMany({
      where: { userId: sId },
      data: { userId: tId }
    });

    // Delete the source user
    await tx.user.delete({ where: { id: sId } });
  });

  console.log('Merge complete. Verifying remapped logs...');
  const targetLogsCountAfter = await prisma.attendanceLog.count({ where: { userId: tId } });
  console.log(`Target logs count after merge: ${targetLogsCountAfter} (Expected: ${sourceLogsCountBefore + targetLogsCountBefore})`);

  if (targetLogsCountAfter !== sourceLogsCountBefore + targetLogsCountBefore) {
    throw new Error('Verification failed: logs count mismatch after merge.');
  }

  // 3. Find the enrollment to unclub
  const enrollmentToUnclub = await prisma.deviceEnrollment.findFirst({
    where: { userId: tId, deviceId: '2' }
  });

  if (!enrollmentToUnclub) {
    throw new Error('Verification failed: target user does not have device 2 enrollment mapping.');
  }

  console.log(`Unclubbing Enrollment ID: ${enrollmentToUnclub.id} (EnrollID: ${enrollmentToUnclub.enrollId}, DeviceId: ${enrollmentToUnclub.deviceId})...`);

  // 4. Perform the UNCLUB transaction (copied from route.ts)
  const deviceId = enrollmentToUnclub.deviceId;
  const enrollId = enrollmentToUnclub.enrollId;
  const suffix = deviceId === '1' ? '(3F)' : '(2F)';
  const username = `${enrollId}-${deviceId === '1' ? '3f' : '2f'}`;
  const cleanName = targetUser.name.replace(/\s*\(2F.*\)/i, '').replace(/\s*\(3F.*\)/i, '').trim();
  const displayName = `${cleanName} (${deviceId === '1' ? '3F' : '2F'})`;
  const displayEnrollId = `${enrollId} ${suffix}`;

  const newUser = await prisma.$transaction(async (tx) => {
    // Create separate user
    const defaultPassword = 'password123-mocked';
    const user = await tx.user.create({
      data: {
        username,
        password: defaultPassword,
        name: displayName,
        role: 'EMPLOYEE',
        enrollId: displayEnrollId,
        dept: targetUser.dept
      }
    });

    // Re-assign DeviceEnrollment to new user
    await tx.deviceEnrollment.update({
      where: { id: enrollmentToUnclub.id },
      data: { userId: user.id }
    });

    // Re-assign matching AttendanceLogs to new user
    await tx.attendanceLog.updateMany({
      where: {
        deviceId: deviceId,
        enrollId: enrollId,
        userId: tId
      },
      data: {
        userId: user.id,
        name: displayName,
        dept: targetUser.dept
      }
    });

    return user;
  });

  console.log(`Unclub complete. Re-created user: ${newUser.name} (ID: ${newUser.id})`);

  // Verify splits
  const targetLogsCountFinal = await prisma.attendanceLog.count({ where: { userId: tId } });
  const newLogsCountFinal = await prisma.attendanceLog.count({ where: { userId: newUser.id } });
  console.log(`Final logs count -> Target: ${targetLogsCountFinal}, New User: ${newLogsCountFinal}`);

  if (targetLogsCountFinal !== targetLogsCountBefore || newLogsCountFinal !== sourceLogsCountBefore) {
    throw new Error('Verification failed: logs counts after unclub do not match original pre-merge values.');
  }

  // Clean up: delete the re-created user and restore the original source user to maintain database consistency
  console.log('Restoring database to original state...');
  await prisma.$transaction(async (tx) => {
    // 0. Rename the temp user's username to avoid unique constraint collision
    await tx.user.update({
      where: { id: newUser.id },
      data: { username: newUser.username + '-temp' }
    });

    // 1. Recreate the source user first
    await tx.user.create({
      data: {
        id: sId,
        username: sourceUser.username,
        password: sourceUser.password,
        name: sourceUser.name,
        role: sourceUser.role,
        enrollId: sourceUser.enrollId,
        dept: sourceUser.dept,
        createdAt: sourceUser.createdAt,
        updatedAt: sourceUser.updatedAt
      }
    });

    // 2. Move enrollment back to restored user
    await tx.deviceEnrollment.update({
      where: { id: enrollmentToUnclub.id },
      data: { userId: sId }
    });

    // 3. Move logs back to restored user
    await tx.attendanceLog.updateMany({
      where: {
        deviceId: deviceId,
        enrollId: enrollId,
        userId: newUser.id
      },
      data: {
        userId: sId,
        name: sourceUser.name,
        dept: sourceUser.dept
      }
    });

    // 4. Delete the temp newUser to clean up
    await tx.user.delete({ where: { id: newUser.id } });
  });

  console.log('=== DB Actions Integration Test: SUCCESS ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
