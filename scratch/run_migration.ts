import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Suffixes and initials to clean from names
const STOP_WORDS = new Set([
  'k', 'i', 'm', 't', 'v', 'a', 'p', 'r', 's', 'n', 'd', 'e', 'u', 'l', 'c',
  'tt', 'ki', 'ap', 'vp', 'eu', 'mv', 'ms', 'kp', 'mm', 'kv', 'cm', 'na', 'nr',
  'av', 'vm', 'rp', 'pr', 'tk', 'cv', 'ol'
]);

function cleanName(name: string): string {
  return name
    .toLowerCase()
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

async function main() {
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

  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' }
  });

  const matches: {
    user: any;
    sheet: SheetRow;
    method: string;
  }[] = [];

  const matchedUserIds = new Set<number>();
  const matchedSheetIds = new Set<number>();

  const registerMatch = (user: any, sheet: SheetRow, method: string) => {
    if (matchedUserIds.has(user.id) || matchedSheetIds.has(sheet.employeeId)) {
      return false;
    }
    matches.push({ user, sheet, method });
    matchedUserIds.add(user.id);
    matchedSheetIds.add(sheet.employeeId);
    return true;
  };

  // Match logic (same as dry-run)
  for (const user of users) {
    if (MANUAL_OVERRIDES[user.id] !== undefined) {
      const targetEmpId = MANUAL_OVERRIDES[user.id];
      const sheetRow = sheetRows.find(r => r.employeeId === targetEmpId);
      if (sheetRow) registerMatch(user, sheetRow, 'Manual Override');
    }
  }

  for (const user of users) {
    if (user.role === 'ADMIN' || matchedUserIds.has(user.id)) continue;
    const userCleaned = cleanName(user.name);
    const exactRow = sheetRows.find(r => r.cleanedName === userCleaned && !matchedSheetIds.has(r.employeeId));
    if (exactRow) registerMatch(user, exactRow, 'Exact Name Match');
  }

  for (const user of users) {
    if (user.role === 'ADMIN' || matchedUserIds.has(user.id)) continue;
    const userCleaned = cleanName(user.name);
    const userFirstWord = userCleaned.split(' ')[0];
    if (!userFirstWord || userFirstWord.length < 3) continue;

    const candidates = sheetRows.filter(r => 
      !matchedSheetIds.has(r.employeeId) && r.cleanedName.startsWith(userFirstWord)
    );
    if (candidates.length === 1) registerMatch(user, candidates[0], 'Fuzzy First Word Match');
  }

  for (const user of users) {
    if (user.role === 'ADMIN' || matchedUserIds.has(user.id)) continue;
    const enrollId = user.enrollId || user.username || '';
    if (!enrollId) continue;
    const row = sheetRows.find(r => 
      !matchedSheetIds.has(r.employeeId) && 
      (String(r.employeeId) === enrollId || (r.enrollId && r.enrollId === enrollId))
    );
    if (row) registerMatch(user, row, 'EnrollID/Username Match');
  }

  console.log(`Prepared migration for ${matches.length} matched users.`);

  // Find unmatched users that currently occupy IDs >= 100
  const unmatchedToMove = users.filter(u => 
    u.role !== 'ADMIN' && 
    !matchedUserIds.has(u.id) && 
    u.id >= 100
  );

  console.log(`Moving ${unmatchedToMove.length} unmatched users to free up ID space.`);

  // 1. Move unmatched users with ID >= 100 to high ID range (id + 10000)
  for (const u of unmatchedToMove) {
    const tempId = u.id + 10000;
    console.log(`Moving unmatched user ID ${u.id} (${u.name}) to temp ID ${tempId}`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET id = ${tempId} WHERE id = ${u.id}`);
  }

  // 2. Move matched users to safe high ID range (id + 20000) to completely free the target IDs
  for (const m of matches) {
    const tempId = m.user.id + 20000;
    console.log(`Moving matched user ID ${m.user.id} (${m.user.name}) to temp ID ${tempId}`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET id = ${tempId} WHERE id = ${m.user.id}`);
  }

  // 3. Update matched users from safe range to final Employee IDs
  for (const m of matches) {
    const tempId = m.user.id + 20000;
    const finalId = m.sheet.employeeId;
    console.log(`Updating matched user ${m.user.name} from temp ID ${tempId} to final ID ${finalId}`);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET id = ${finalId} WHERE id = ${tempId}`);
  }

  // 4. Reset serial sequence in PostgreSQL
  console.log('Resetting serial sequence for User table...');
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id), 0) + 1, false) FROM "User"`);

  console.log('Migration successfully completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
