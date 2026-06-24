import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Manual overrides mapping DB IDs to target spreadsheet IDs
const MANUAL_OVERRIDES: { [dbId: number]: number } = {
  5: 181,   // Neethul (User 5) -> Neethul R (Sheet 181)
  29: 120,  // Shibina (User 29) -> Shibina Rosely c (Sheet 120)
  9: 130,   // Vineeth V (User 9) -> Vineeth T T (Sheet 130)
  11: 237,  // Vineeth (User 11) -> VINEETH M V (Sheet 237)
  15: 255,  // Ayana (User 15) -> Ayana (Sheet 255)
  25: 104,  // Shilpa T (User 25) -> Shilpa Santhosh T (Sheet 104)
  36: 140,  // Shilpa K (User 36) -> Shilpa K U (Sheet 140)
  33: 156,  // Sanoop (User 33) -> SANOOP V (Sheet 156)
  63: 306,  // Aishwarya M (User 63) -> Aishwarya Mohod (Sheet 306)
  35: 287,  // Liya (User 35) -> Liya KV (Sheet 287)
  66: 308,  // 617 (User 66) -> Karthik Vadakkoott (Sheet 308)
  42: 128,  // Arjun (User 42) -> Arjun pokkattu (Sheet 128)
  83: 217,  // Arjun M (User 83) -> ARJUN M (Sheet 217)
  84: 218,  // Arjun N (User 84) -> ARJUN N (Sheet 218)
  54: 102,  // Nithin U (User 54) -> Nithin U (Sheet 102)
  43: 149,  // Nithin P (User 43) -> Nithin Peechangoli (Sheet 149)
  109: 160, // Prashobh (User 109) -> Prashobh P (Sheet 160)
  44: 198,  // Jithin (User 44) -> Jithin M (Sheet 198)
  117: 143, // Sudheesh (User 117) -> Sudheesh Acheerithodi (Sheet 143)
  138: 328, // Aiswarya (User 138) -> Aiswarya Baburaj (Sheet 328)
  86: 219,  // Dilnavas (User 86) -> DILNAVAS C.P (Sheet 219)
  156: 322, // Vishnu R (User 156) -> Vishnu R (Sheet 322)
  152: 246, // Indu (User 152) -> Indu Venugopal (Sheet 246)
  24: 171,  // Binoy (User 24) -> Binoy Mohan (Sheet 171)
  28: 248,  // Akhil Raj (User 28) -> Akhilraj K (Sheet 248)
  91: 125,  // SarathM (User 91) -> Sarath M joy (Sheet 125)
  53: 203,  // Albin (User 53) -> Albin Geo (Sheet 203)
  137: 231, // Prashanth (User 137) -> Prasanth V P (Sheet 231)
};

// Suffixes and initials to clean from names
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

interface SheetRow {
  employeeId: number;
  name: string;
  enrollId: string;
  cleanedName: string;
}

async function main() {
  const commit = process.argv.includes('--commit');
  const csvPath = path.join(__dirname, 'employees.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const sheetRows: SheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 2) continue;

    const empIdStr = parts[0].trim();
    const name = parts[1].trim();
    const enrollId = parts[2] ? parts[2].trim() : '';

    if (!name) continue;
    const employeeId = empIdStr ? parseInt(empIdStr, 10) : NaN;
    if (isNaN(employeeId)) continue;

    sheetRows.push({
      employeeId,
      name,
      enrollId,
      cleanedName: cleanName(name)
    });
  }

  // Load all users from the production database
  const users = await prisma.user.findMany({
    include: {
      deviceEnrollments: true
    }
  });

  // Determine target spreadsheet IDs for 3F/Device 1 users
  // We match users to spreadsheet rows using the same logic as the migration script
  const userToSheetMap = new Map<number, SheetRow>();

  // 1. Manual Overrides
  for (const user of users) {
    const originalId = user.id >= 10000 ? user.id - 10000 : user.id;
    if (MANUAL_OVERRIDES[originalId] !== undefined) {
      const targetEmpId = MANUAL_OVERRIDES[originalId];
      const sheetRow = sheetRows.find(r => r.employeeId === targetEmpId);
      if (sheetRow) {
        userToSheetMap.set(user.id, sheetRow);
      }
    }
  }

  // 2. Exact Name Matches
  for (const user of users) {
    if (user.role === 'ADMIN' || userToSheetMap.has(user.id)) continue;
    const userCleaned = cleanName(user.name);
    const exactRow = sheetRows.find(r => r.cleanedName === userCleaned);
    if (exactRow) {
      userToSheetMap.set(user.id, exactRow);
    }
  }

  // 3. Fuzzy matches
  for (const user of users) {
    if (user.role === 'ADMIN' || userToSheetMap.has(user.id)) continue;
    const userCleaned = cleanName(user.name);
    const userFirstWord = userCleaned.split(' ')[0];
    if (!userFirstWord || userFirstWord.length < 3) continue;

    const candidates = sheetRows.filter(r => r.cleanedName.startsWith(userFirstWord));
    if (candidates.length === 1) {
      userToSheetMap.set(user.id, candidates[0]);
    }
  }

  // 4. Match by enrollId / username matching Employee ID
  for (const user of users) {
    if (user.role === 'ADMIN' || userToSheetMap.has(user.id)) continue;
    const rawEnrollId = user.username.split('-')[0] || '';
    if (!rawEnrollId) continue;
    const row = sheetRows.find(r => String(r.employeeId) === rawEnrollId || (r.enrollId && r.enrollId === rawEnrollId));
    if (row) {
      userToSheetMap.set(user.id, row);
    }
  }

  console.log(`Mapped ${userToSheetMap.size} database users to spreadsheet rows.`);

  // Find 2F users whose names are numbers (like "237 (2F)" or "237") OR whose enrollId matches a spreadsheet Employee ID
  const numerical2FUsers = users.filter(u => {
    const hasDevice2 = u.deviceEnrollments.some(e => e.deviceId === '2');
    const hasDevice1 = u.deviceEnrollments.some(e => e.deviceId === '1');
    if (!hasDevice2 || hasDevice1) return false;

    // Check if name is purely numerical (after cleaning) or username is a number
    const isNumName = /^\d+$/.test(u.name.replace(/\s*\(2f.*\)/i, '').trim());
    return isNumName;
  });

  console.log(`Found ${numerical2FUsers.length} numerical-name 2F users.`);

  const numericalPairsToMerge: { source: any; target: any; spreadsheetId: number; name: string }[] = [];

  for (const s of numerical2FUsers) {
    const sEnrollId = s.deviceEnrollments.find(e => e.deviceId === '2')?.enrollId;
    if (!sEnrollId) continue;

    const targetSpreadsheetId = parseInt(sEnrollId, 10);
    if (isNaN(targetSpreadsheetId)) continue;

    // Find the 3F user mapped to this spreadsheet ID
    const targetUser = Array.from(userToSheetMap.entries()).find(([uId, sheet]) => sheet.employeeId === targetSpreadsheetId);

    if (targetUser) {
      const [tId, sheet] = targetUser;
      const t = users.find(u => u.id === tId)!;
      numericalPairsToMerge.push({
        source: s,
        target: t,
        spreadsheetId: targetSpreadsheetId,
        name: sheet.name
      });
    } else {
      // Look if there's any user whose username prefix is targetSpreadsheetId
      const targetUserByUsername = users.find(u => u.username === `${targetSpreadsheetId}-3f`);
      if (targetUserByUsername) {
        numericalPairsToMerge.push({
          source: s,
          target: targetUserByUsername,
          spreadsheetId: targetSpreadsheetId,
          name: targetUserByUsername.name
        });
      } else {
        console.log(`Could not find target 3F user for 2F user "${s.name}" (spreadsheet ID ${targetSpreadsheetId})`);
      }
    }
  }

  console.log(`\nFound ${numericalPairsToMerge.length} numerical duplicate pairs to merge.`);

  for (const pair of numericalPairsToMerge) {
    const s = pair.source;
    const t = pair.target;
    console.log(`\n--------------------------------------------------`);
    console.log(`Merge candidate: "${pair.name}" (Spreadsheet ID: ${pair.spreadsheetId})`);
    console.log(`  Source (2F): ID=${s.id}, Name="${s.name}", Username="${s.username}", EnrollId="${s.deviceEnrollments.find(e => e.deviceId === '2')?.enrollId}"`);
    console.log(`  Target (3F): ID=${t.id}, Name="${t.name}", Username="${t.username}", EnrollId="${t.deviceEnrollments.find(e => e.deviceId === '1')?.enrollId}"`);

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

          // 5. Delete source user
          await tx.user.delete({ where: { id: s.id } });
          console.log(`    Deleted source user ID ${s.id}.`);
        });
        console.log(`  Merge completed successfully!`);
      } catch (err) {
        console.error(`  Merge failed for "${pair.name}":`, err);
      }
    }
  }

  console.log('\nDone.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
