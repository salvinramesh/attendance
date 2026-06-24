import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Clean names for matching
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

async function main() {
  console.log('Retrieving unique scannerUserIds and names from logs...');
  const logs = await prisma.attendanceLog.findMany({
    where: { deviceId: '1', scannerUserId: { not: null } },
    select: { scannerUserId: true, name: true }
  });

  // Map of scannerUserId -> Map of name -> count
  const counts = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const suid = log.scannerUserId!;
    const name = log.name || '';
    if (!counts.has(suid)) counts.set(suid, new Map());
    const m = counts.get(suid)!;
    m.set(name, (m.get(name) || 0) + 1);
  }

  // Map of scannerUserId -> best name
  const bestNames = new Map<string, string>();
  for (const [suid, m] of counts.entries()) {
    let bestName = '';
    let maxCount = -1;
    for (const [name, count] of m.entries()) {
      if (count > maxCount) {
        maxCount = count;
        bestName = name;
      }
    }
    bestNames.set(suid, bestName);
  }

  // Load all employees (id >= 100 and id < 10000)
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', id: { lt: 10000 } }
  });

  console.log(`Loaded ${employees.length} employees and ${bestNames.size} scanner IDs.`);

  // We will perform matches
  const matches: { empId: number; empName: string; enrollId: string; scannerName: string; method: string }[] = [];
  const matchedEmpIds = new Set<number>();
  const matchedEnrollIds = new Set<string>();

  const registerMatch = (empId: number, empName: string, enrollId: string, scannerName: string, method: string) => {
    if (matchedEmpIds.has(empId) || matchedEnrollIds.has(enrollId)) return false;
    matches.push({ empId, empName, enrollId, scannerName, method });
    matchedEmpIds.add(empId);
    matchedEnrollIds.add(enrollId);
    return true;
  };

  // 1. Manual Overrides
  registerMatch(201, "SALVIN RAMESH", "27", "Salvin", "Manual"); // Salvin Ramesh -> Enroll ID 27

  // 2. Exact Name Match (after cleaning)
  for (const emp of employees) {
    const cleanEmpName = cleanName(emp.name);
    for (const [enrollId, scannerName] of bestNames.entries()) {
      if (cleanName(scannerName) === cleanEmpName) {
        registerMatch(emp.id, emp.name, enrollId, scannerName, "Exact Name");
      }
    }
  }

  // 3. First Word Match (single candidated)
  for (const emp of employees) {
    if (matchedEmpIds.has(emp.id)) continue;
    const cleanEmpName = cleanName(emp.name);
    const firstWord = cleanEmpName.split(' ')[0];
    if (!firstWord || firstWord.length < 3) continue;

    const candidates = Array.from(bestNames.entries()).filter(([enrollId, scannerName]) => {
      const cleanScanner = cleanName(scannerName);
      return !matchedEnrollIds.has(enrollId) && cleanScanner.startsWith(firstWord);
    });

    if (candidates.length === 1) {
      registerMatch(emp.id, emp.name, candidates[0][0], candidates[0][1], "Fuzzy First Word");
    }
  }

  // Write out the summary
  console.log(`Matched ${matches.length} employees.`);
  
  // Write to a summary file to see matches
  let out = `# Office 1 Automatic Matches\n\n`;
  out += `| Employee ID | Name | Office 1 Enroll ID | Scanner Name | Method |\n`;
  out += `|---|---|---|---|---|\n`;
  for (const m of matches.sort((a,b)=>a.empId - b.empId)) {
    out += `| ${m.empId} | ${m.empName} | ${m.enrollId} | ${m.scannerName} | ${m.method} |\n`;
  }

  out += `\n## Unmatched Employees\n\n`;
  for (const emp of employees) {
    if (!matchedEmpIds.has(emp.id)) {
      out += `- [ID: ${emp.id}] Name: ${emp.name}\n`;
    }
  }

  out += `\n## Unmatched Scanner IDs\n\n`;
  for (const [enrollId, scannerName] of bestNames.entries()) {
    if (!matchedEnrollIds.has(enrollId)) {
      out += `- [Enroll ID: ${enrollId}] Name: ${scannerName}\n`;
    }
  }

  fs.writeFileSync(path.join(__dirname, 'office1_matches.md'), out);
  console.log('Saved matches to office1_matches.md');

  // Let's also save the matches JSON to a file so we can read it in the seeder
  fs.writeFileSync(path.join(__dirname, 'office1_matches.json'), JSON.stringify(matches, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
