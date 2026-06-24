import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STOP_WORDS = new Set([
  'k', 'i', 'm', 't', 'v', 'a', 'p', 'r', 's', 'n', 'd', 'e', 'u', 'l', 'c',
  'tt', 'ki', 'ap', 'vp', 'eu', 'mv', 'ms', 'kp', 'mm', 'kv', 'cm', 'na', 'nr',
  'av', 'vm', 'rp', 'pr', 'tk', 'cv', 'ol'
]);

function cleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(2f.*\)/i, '')
    .replace(/\s*\(3f.*\)/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(token => token && !STOP_WORDS.has(token))
    .join(' ');
}

function getBaseName(name: string): string {
  return name
    .replace(/\s*\(2f.*\)/i, '')
    .replace(/\s*\(3f.*\)/i, '')
    .trim();
}

async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`=== Employee Duplicate Matcher & Merger (Commit: ${commit}) ===`);

  const users = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    include: {
      deviceEnrollments: true
    }
  });

  console.log(`Found ${users.length} employee accounts in database.`);

  // Group by cleaned name
  const groups = new Map<string, typeof users>();
  for (const user of users) {
    const cleaned = cleanName(user.name);
    if (!cleaned) continue;
    if (!groups.has(cleaned)) {
      groups.set(cleaned, []);
    }
    groups.get(cleaned)!.push(user);
  }

  const pairsToMerge: { source: any; target: any; cleanedName: string }[] = [];
  const singleUsersWithSuffix: any[] = [];

  for (const [cleaned, groupUsers] of groups.entries()) {
    if (groupUsers.length === 1) {
      const u = groupUsers[0];
      if (u.name.includes('(3F)') || u.name.includes('(2F)')) {
        singleUsersWithSuffix.push(u);
      }
      continue;
    }

    // We have duplicates! Let's find the 3F (or Device 1) user and 2F (or Device 2) user
    const user3F = groupUsers.find(u => u.name.includes('(3F)') || u.deviceEnrollments.some(e => e.deviceId === '1'));
    const user2F = groupUsers.find(u => u.name.includes('(2F)') || (u.deviceEnrollments.some(e => e.deviceId === '2') && !u.deviceEnrollments.some(e => e.deviceId === '1')));

    if (user3F && user2F && user3F.id !== user2F.id) {
      pairsToMerge.push({
        source: user2F,
        target: user3F,
        cleanedName: cleaned
      });
    } else {
      console.log(`[Ambiguous Group] Cleaned: "${cleaned}" has ${groupUsers.length} users but no clear 3F/2F pair:`, 
        groupUsers.map(u => ({ id: u.id, name: u.name, enrollId: u.enrollId, devices: u.deviceEnrollments.map(e => e.deviceId) }))
      );
    }
  }

  console.log(`\nFound ${pairsToMerge.length} clear duplicate pairs to merge.`);

  for (const pair of pairsToMerge) {
    const s = pair.source;
    const t = pair.target;
    const cleanTargetName = getBaseName(t.name);

    console.log(`\n--------------------------------------------------`);
    console.log(`Merge candidate: "${cleanTargetName}"`);
    console.log(`  Source (2F): ID=${s.id}, Name="${s.name}", Username="${s.username}", EnrollId="${s.enrollId}"`);
    console.log(`  Target (3F): ID=${t.id}, Name="${t.name}", Username="${t.username}", EnrollId="${t.enrollId}"`);

    if (commit) {
      console.log(`  Executing transaction merge...`);
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Merge DeviceEnrollments
          const sourceEnrollments = await tx.deviceEnrollment.findMany({ where: { userId: s.id } });
          const targetEnrollments = await tx.deviceEnrollment.findMany({ where: { userId: t.id } });

          for (const se of sourceEnrollments) {
            const hasConflict = targetEnrollments.some(
              (te) => te.deviceId === se.deviceId && te.enrollId === se.enrollId
            );

            if (hasConflict) {
              console.log(`    Deleting conflicting enrollment: Device ${se.deviceId}, EnrollId ${se.enrollId}`);
              await tx.deviceEnrollment.delete({ where: { id: se.id } });
            } else {
              console.log(`    Reassigning enrollment: Device ${se.deviceId}, EnrollId ${se.enrollId} to Target ID ${t.id}`);
              await tx.deviceEnrollment.update({
                where: { id: se.id },
                data: { userId: t.id, syncStatus: se.deviceId === '2' ? 'PENDING' : se.syncStatus }
              });
            }
          }

          // 2. Move WFH logs
          const wfhRes = await tx.wFHLog.updateMany({
            where: { userId: s.id },
            data: { userId: t.id }
          });
          console.log(`    Moved ${wfhRes.count} WFH logs.`);

          // Move Attendance logs
          const attRes = await tx.attendanceLog.updateMany({
            where: { userId: s.id },
            data: { userId: t.id }
          });
          console.log(`    Moved ${attRes.count} attendance logs.`);

          // 3. Move LeaveRecords
          const sourceLeaves = await tx.leaveRecord.findMany({ where: { userId: s.id } });
          const targetLeaves = await tx.leaveRecord.findMany({ where: { userId: t.id } });

          for (const sl of sourceLeaves) {
            const hasConflict = targetLeaves.some((tl) => tl.date === sl.date);
            if (hasConflict) {
              await tx.leaveRecord.delete({ where: { id: sl.id } });
            } else {
              await tx.leaveRecord.update({
                where: { id: sl.id },
                data: { userId: t.id }
              });
            }
          }

          // 4. Move LeaveBalances
          const sourceBalances = await tx.leaveBalance.findMany({ where: { userId: s.id } });
          const targetBalances = await tx.leaveBalance.findMany({ where: { userId: t.id } });

          for (const sb of sourceBalances) {
            const hasConflict = targetBalances.some((tb) => tb.year === sb.year && tb.month === sb.month);
            if (hasConflict) {
              await tx.leaveBalance.delete({ where: { id: sb.id } });
            } else {
              await tx.leaveBalance.update({
                where: { id: sb.id },
                data: { userId: t.id }
              });
            }
          }

          // 5. Update target user name to cleaned name and clear floor suffix
          await tx.user.update({
            where: { id: t.id },
            data: { 
              name: cleanTargetName,
              enrollId: t.enrollId ? getBaseName(t.enrollId) : null
            }
          });
          console.log(`    Updated target user name to "${cleanTargetName}"`);

          // 6. Delete source user
          await tx.user.delete({ where: { id: s.id } });
          console.log(`    Deleted source user ID ${s.id}.`);
        });
        console.log(`  Merge completed successfully!`);
      } catch (err) {
        console.error(`  Merge failed for "${cleanTargetName}":`, err);
      }
    }
  }

  // Also clean name suffixes of single users who have (3F) or (2F) but no duplicate
  console.log(`\nFound ${singleUsersWithSuffix.length} single users with floor suffixes to clean.`);
  for (const u of singleUsersWithSuffix) {
    const cleanNameStr = getBaseName(u.name);
    console.log(`Cleaning suffix for single user: "${u.name}" -> "${cleanNameStr}"`);
    if (commit) {
      await prisma.user.update({
        where: { id: u.id },
        data: { 
          name: cleanNameStr,
          enrollId: u.enrollId ? getBaseName(u.enrollId) : null
        }
      });
    }
  }

  console.log('\nDone.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
