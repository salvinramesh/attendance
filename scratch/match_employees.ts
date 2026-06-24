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

// Manual overrides for matches we want to ensure or override
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

  // Helper to register a match
  const registerMatch = (user: any, sheet: SheetRow, method: string) => {
    if (matchedUserIds.has(user.id) || matchedSheetIds.has(sheet.employeeId)) {
      return false;
    }
    matches.push({ user, sheet, method });
    matchedUserIds.add(user.id);
    matchedSheetIds.add(sheet.employeeId);
    return true;
  };

  // Phase 1: Manual Overrides
  for (const user of users) {
    if (MANUAL_OVERRIDES[user.id] !== undefined) {
      const targetEmpId = MANUAL_OVERRIDES[user.id];
      const sheetRow = sheetRows.find(r => r.employeeId === targetEmpId);
      if (sheetRow) {
        registerMatch(user, sheetRow, 'Manual Override');
      }
    }
  }

  // Phase 2: Exact Name Matches
  for (const user of users) {
    if (user.role === 'ADMIN' || matchedUserIds.has(user.id)) continue;
    const userCleaned = cleanName(user.name);
    const exactRow = sheetRows.find(r => r.cleanedName === userCleaned && !matchedSheetIds.has(r.employeeId));
    if (exactRow) {
      registerMatch(user, exactRow, 'Exact Name Match');
    }
  }

  // Phase 3: Fuzzy Matches where first word matches
  for (const user of users) {
    if (user.role === 'ADMIN' || matchedUserIds.has(user.id)) continue;
    const userCleaned = cleanName(user.name);
    const userFirstWord = userCleaned.split(' ')[0];
    if (!userFirstWord || userFirstWord.length < 3) continue;

    // Find a sheet row where first word matches and there's no other name ambiguity
    const candidates = sheetRows.filter(r => 
      !matchedSheetIds.has(r.employeeId) && 
      r.cleanedName.startsWith(userFirstWord)
    );

    if (candidates.length === 1) {
      registerMatch(user, candidates[0], 'Fuzzy First Word Match');
    }
  }

  // Phase 4: Match by enrollId / username matching Employee ID
  for (const user of users) {
    if (user.role === 'ADMIN' || matchedUserIds.has(user.id)) continue;
    const enrollId = user.enrollId || user.username || '';
    if (!enrollId) continue;

    const row = sheetRows.find(r => 
      !matchedSheetIds.has(r.employeeId) && 
      (String(r.employeeId) === enrollId || (r.enrollId && r.enrollId === enrollId))
    );

    if (row) {
      registerMatch(user, row, 'EnrollID/Username Match');
    }
  }

  // Output matched results
  console.log(`Successfully matched ${matches.length} / ${users.length - 1} employees.`);

  // Write markdown summary
  let md = `# Employee Mappings Summary\n\n`;
  md += `Total Matched: ${matches.length} / ${users.length - 1} employees.\n\n`;
  md += `| DB User ID | DB Username | Current Name | Target ID | Sheet Name | Match Method |\n`;
  md += `|---|---|---|---|---|---|\n`;

  matches.sort((a, b) => a.user.id - b.user.id);
  matches.forEach(m => {
    md += `| ${m.user.id} | ${m.user.username} | ${m.user.name} | **${m.sheet.employeeId}** | ${m.sheet.name} | ${m.method} |\n`;
  });

  md += `\n## Unmatched DB Users\n\n`;
  users.filter(u => u.role !== 'ADMIN' && !matchedUserIds.has(u.id)).forEach(u => {
    md += `- [ID: ${u.id}] Username: \`${u.username}\`, Name: \`${u.name}\` (Logs count: ${u.role === 'ADMIN' ? 0 : 'check logs'})\n`;
  });

  md += `\n## Unmatched Spreadsheet Rows\n\n`;
  sheetRows.filter(r => !matchedSheetIds.has(r.employeeId)).forEach(r => {
    md += `- [Employee ID: ${r.employeeId}] Name: \`${r.name}\`, Enroll ID: \`${r.enrollId || 'none'}\`\n`;
  });

  fs.writeFileSync(path.join(__dirname, 'matched_summary.md'), md);
  console.log('Summary saved to matched_summary.md');
}

main().catch(console.error);
