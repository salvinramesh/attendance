import { prisma } from '../lib/prisma';
import { parse, format } from 'date-fns';
import fs from 'fs';
import path from 'path';

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1fnBKf8604vthAyezQJNfV70m--HdxZSaCeG4sfcbR8I/export?format=csv&gid=1319344278';
const STATE_FILE_PATH = path.join(process.cwd(), 'scratch', 'google-leaves-state.json');

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result.map(val => {
    if (val.startsWith('"') && val.endsWith('"')) {
      return val.substring(1, val.length - 1).trim();
    }
    return val;
  });
}

function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const result: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: any = {};
    headers.forEach((h, idx) => {
      if (h) {
        row[h] = values[idx] ?? '';
      }
    });
    result.push(row);
  }
  return result;
}

function parseSheetDate(val: any): Date | null {
  if (!val) return null;
  const valStr = String(val).trim();
  
  // If Excel serial number (pure digits, e.g. "46024"), convert to JavaScript Date
  if (/^\d+$/.test(valStr)) {
    const serial = parseInt(valStr, 10);
    if (serial > 30000 && serial < 60000) {
      return new Date(Math.round((serial - 25569) * 86400 * 1000));
    }
  }

  const d = new Date(valStr);
  if (!isNaN(d.getTime())) return d;
  
  // Try formats like "d-MMM-yyyy" (e.g. 2-Jan-2026)
  try {
    const parsed = parse(valStr, 'd-MMM-yyyy', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}

  // Try formats like "d-MMM-yy" (e.g. 2-Jan-26)
  try {
    const parsed = parse(valStr, 'd-MMM-yy', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}

  // Try standard slash formatting "M/d/yyyy"
  try {
    const parsed = parse(valStr, 'M/d/yyyy', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {}

  return null;
}

export async function syncGoogleLeaves() {
  console.log(`[${new Date().toISOString()}] Starting Google Sheet leaves sync...`);
  
  // 1. Read existing state
  let state: Record<string, { userId: number; dates: string[]; status: string }> = {};
  if (fs.existsSync(STATE_FILE_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf8'));
      console.log(`Loaded state containing ${Object.keys(state).length} previously tracked tickets.`);
    } catch (e: any) {
      console.error('Failed to parse state file, starting fresh:', e.message);
    }
  }

  // Ensure scratch directory exists
  const scratchDir = path.dirname(STATE_FILE_PATH);
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // 2. Fetch sheet CSV
  console.log(`Fetching sheet from ${GOOGLE_SHEET_CSV_URL}...`);
  const response = await fetch(GOOGLE_SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV: ${response.statusText}`);
  }
  const csvText = await response.text();

  // 3. Parse CSV using custom parser
  const data = parseCSV(csvText);
  console.log(`Fetched and parsed ${data.length} rows from Google Sheet.`);

  let createdCount = 0;
  let deletedCount = 0;
  
  const affectedUsersAndYears = new Map<number, Set<number>>();
  function markAffected(userId: number, year: number) {
    if (!affectedUsersAndYears.has(userId)) {
      affectedUsersAndYears.set(userId, new Set());
    }
    affectedUsersAndYears.get(userId)!.add(year);
  }

  const currentSheetTickets = new Set<string>();

  // 4. Process spreadsheet rows
  for (const row of data) {
    let ticketNumber = '';
    let employeeId = '';
    let name = '';
    let startDateStr = '';
    let endDateStr = '';
    let countInDays = 1;
    let leaveType = '';
    let approvals = '';

    for (const key of Object.keys(row)) {
      const lk = key.toLowerCase().trim();
      const val = String(row[key] ?? '').trim();
      if (lk === 'ticket number' || lk.includes('ticket')) {
        ticketNumber = val;
      } else if (lk === 'employee id' || lk.includes('employee id')) {
        employeeId = val;
      } else if (lk === 'name') {
        name = val;
      } else if (lk === 'start date' || lk.includes('start date')) {
        startDateStr = val;
      } else if (lk === 'end date' || lk.includes('end date')) {
        endDateStr = val;
      } else if (lk === 'count in days' || lk.includes('count')) {
        countInDays = parseFloat(val) || 1;
      } else if (lk === 'leave type' || lk.includes('leave type')) {
        leaveType = val;
      } else if (lk === 'approvals' || lk === 'approval' || lk.includes('approval')) {
        approvals = val;
      }
    }

    if (!ticketNumber || !employeeId) {
      continue;
    }

    currentSheetTickets.add(ticketNumber);

    const savedTicket = state[ticketNumber];
    const currentStatus = approvals.trim();

    // Check status changes
    let needsAdd = false;
    let needsDelete = false;

    if (!savedTicket) {
      // First time we see this ticket
      if (currentStatus === 'Approved') {
        needsAdd = true;
      } else {
        // Just track it as is
        state[ticketNumber] = { userId: 0, dates: [], status: currentStatus };
      }
    } else {
      // Ticket is already tracked
      if (savedTicket.status !== currentStatus) {
        console.log(`Ticket ${ticketNumber} status changed: ${savedTicket.status} -> ${currentStatus}`);
        if (currentStatus === 'Approved') {
          needsAdd = true;
        } else {
          // If it was previously approved and is now cancelled or pending, delete database leaves
          if (savedTicket.status === 'Approved') {
            needsDelete = true;
          }
          state[ticketNumber].status = currentStatus;
        }
      }
    }

    // Execute deletion if needed
    if (needsDelete && savedTicket) {
      await deleteTicketLeaves(ticketNumber, savedTicket);
      state[ticketNumber] = { userId: 0, dates: [], status: currentStatus };
      deletedCount++;
    }

    // Execute addition if needed
    if (needsAdd) {
      // Resolve user via numeric Employee ID
      const empIdMatch = employeeId.match(/E-(\d+)/);
      const numericPart = empIdMatch ? empIdMatch[1] : employeeId.trim();

      if (!numericPart || numericPart === '--') {
        console.warn(`Skipping Ticket ${ticketNumber}: Invalid Employee ID format: "${employeeId}"`);
        state[ticketNumber] = { userId: 0, dates: [], status: 'Invalid Employee ID' };
        continue;
      }

      const userMatch = await prisma.user.findFirst({
        where: {
          OR: [
            { username: numericPart },
            { username: String(parseInt(numericPart, 10)) },
            { username: numericPart.padStart(3, '0') }
          ]
        }
      });

      if (!userMatch) {
        console.warn(`Skipping Ticket ${ticketNumber}: User not found with Employee ID: "${employeeId}" (mapped numeric ID: "${numericPart}")`);
        state[ticketNumber] = { userId: 0, dates: [], status: 'User Not Found' };
        continue;
      }

      // Parse dates
      const start = parseSheetDate(startDateStr);
      const end = parseSheetDate(endDateStr);
      if (!start || !end) {
        console.warn(`Skipping Ticket ${ticketNumber}: Failed to parse dates: "${startDateStr}" / "${endDateStr}"`);
        state[ticketNumber] = { userId: 0, dates: [], status: 'Date Parse Error' };
        continue;
      }

      // Expand dates in range
      const datesInRange: string[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        datesInRange.push(format(curr, 'yyyy-MM-dd'));
        curr.setDate(curr.getDate() + 1);
      }

      if (datesInRange.length === 0) {
        continue;
      }

      // Resolve leave type code
      let typeCode = 'PL';
      const typeLower = leaveType.toLowerCase();
      if (typeLower.includes('emergency')) {
        typeCode = 'EL';
      } else if (typeLower.includes('lop')) {
        typeCode = 'LOP';
      }

      if (countInDays === 0.5) {
        typeCode += '_HALF';
      }

      // Insert leave records in the DB
      console.log(`Adding leaves for Ticket ${ticketNumber} (Employee: ${userMatch.name}, ID: ${employeeId}) on dates: ${datesInRange.join(', ')}`);
      for (const d of datesInRange) {
        await prisma.leaveRecord.upsert({
          where: {
            userId_date: {
              userId: userMatch.id,
              date: d
            }
          },
          update: {
            type: typeCode
          },
          create: {
            userId: userMatch.id,
            date: d,
            type: typeCode
          }
        });
        
        const year = new Date(d).getFullYear();
        markAffected(userMatch.id, year);
      }

      state[ticketNumber] = {
        userId: userMatch.id,
        dates: datesInRange,
        status: 'Approved'
      };
      createdCount++;
    }
  }

  // 5. Clean up tickets that were deleted from the spreadsheet entirely
  for (const ticketNo of Object.keys(state)) {
    if (!currentSheetTickets.has(ticketNo)) {
      const savedTicket = state[ticketNo];
      console.log(`Ticket ${ticketNo} was removed from the Google Sheet.`);
      if (savedTicket && savedTicket.status === 'Approved') {
        await deleteTicketLeaves(ticketNo, savedTicket);
        deletedCount++;
      }
      delete state[ticketNo];
    }
  }

  // Deletion helper
  async function deleteTicketLeaves(ticketNo: string, savedInfo: { userId: number; dates: string[] }) {
    const { userId, dates } = savedInfo;
    if (userId && dates && dates.length > 0) {
      console.log(`Deleting leaves for Ticket ${ticketNo} on dates: ${dates.join(', ')}`);
      await prisma.leaveRecord.deleteMany({
        where: {
          userId: userId,
          date: { in: dates }
        }
      });
      
      for (const d of dates) {
        const year = new Date(d).getFullYear();
        markAffected(userId, year);
      }
    }
  }

  // 6. Recalculate affected users leave balances
  if (affectedUsersAndYears.size > 0) {
    console.log(`Recalculating leave balances for ${affectedUsersAndYears.size} affected employees...`);
    for (const [userId, years] of affectedUsersAndYears.entries()) {
      for (const year of years) {
        const userLeaves = await prisma.leaveRecord.findMany({
          where: {
            userId: userId,
            date: { startsWith: String(year) }
          }
        });

        // Calculate yearly summary (month = 0)
        let plannedY = 0, emergencyY = 0, lopY = 0, pendingY = 0, totalY = 0;
        for (const rec of userLeaves) {
           if (rec.type === 'PL') plannedY += 1.0;
           else if (rec.type === 'PL_HALF') plannedY += 0.5;
           else if (rec.type === 'EL') emergencyY += 1.0;
           else if (rec.type === 'EL_HALF') emergencyY += 0.5;
           else if (rec.type === 'LOP') lopY += 1.0;
           else if (rec.type === 'LOP_HALF') lopY += 0.5;
           else if (rec.type === 'Pending_HALF') pendingY += 0.5;
           else pendingY += 1.0;
           
           if (rec.type.endsWith('_HALF')) totalY += 0.5;
           else totalY += 1.0;
        }

        await prisma.leaveBalance.upsert({
           where: {
             userId_year_month: { userId, year, month: 0 }
           },
           update: { planned: plannedY, emergency: emergencyY, lop: lopY, pending: pendingY, total: totalY },
           create: { userId, year, month: 0, planned: plannedY, emergency: emergencyY, lop: lopY, pending: pendingY, total: totalY }
        });

        // Calculate month-wise balances (month = 1..12)
        for (let m = 1; m <= 12; m++) {
           const monthStr = String(m).padStart(2, '0');
           const monthLeaves = userLeaves.filter(rec => rec.date.startsWith(`${year}-${monthStr}`));

           let plannedM = 0, emergencyM = 0, lopM = 0, pendingM = 0, totalM = 0;
           for (const rec of monthLeaves) {
              if (rec.type === 'PL') plannedM += 1.0;
              else if (rec.type === 'PL_HALF') plannedM += 0.5;
              else if (rec.type === 'EL') emergencyM += 1.0;
              else if (rec.type === 'EL_HALF') emergencyM += 0.5;
              else if (rec.type === 'LOP') lopM += 1.0;
              else if (rec.type === 'LOP_HALF') lopM += 0.5;
              else if (rec.type === 'Pending_HALF') pendingM += 0.5;
              else pendingM += 1.0;
              
              if (rec.type.endsWith('_HALF')) totalM += 0.5;
              else totalM += 1.0;
           }

           if (monthLeaves.length > 0 || (await prisma.leaveBalance.findUnique({ where: { userId_year_month: { userId, year, month: m } } }))) {
               await prisma.leaveBalance.upsert({
                  where: {
                    userId_year_month: { userId, year, month: m }
                  },
                  update: { planned: plannedM, emergency: emergencyM, lop: lopM, pending: pendingM, total: totalM },
                  create: { userId, year, month: m, planned: plannedM, emergency: emergencyM, lop: lopM, pending: pendingM, total: totalM }
               });
           }
        }
      }
    }
  }

  // 7. Write updated state
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
  console.log(`Leaves sync completed. Created/Updated: ${createdCount}, Deleted/Cancelled: ${deletedCount}`);
  
  return { createdCount, deletedCount };
}

// Run immediately if this script is executed directly
if (require.main === module) {
  syncGoogleLeaves()
    .then(() => {
      console.log('Direct execution sync done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Direct execution sync failed:', err);
      process.exit(1);
    });
}
