import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Read raw data from Excel (handling Excel dates correctly if they are serial numbers or strings)
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd' });

    let createdOrUpdated = 0;
    
    // Process individual leave records
    for (const row of data) {
       // Look for variations in headers
       let enrollId = '';
       let dateStr = '';
       let leaveType = '';

       for (const key of Object.keys(row)) {
          const lk = key.toLowerCase();
          if (lk.includes('enroll id') || lk === 'enrollid' || lk === 'id') {
              enrollId = String(row[key]).trim();
          } else if (lk.includes('date')) {
              dateStr = String(row[key]).trim(); // Could be '1/2/2025' or '2025-01-02'
          } else if (lk.includes('leave type') || lk === 'type') {
              leaveType = String(row[key]).trim().toUpperCase();
          }
       }

       if (!enrollId || !dateStr || !leaveType) continue; // Skip malformed rows

       // Try to format date
       let finalDate = '';
       try {
          let parsedDate: Date;
          if (dateStr.includes('/')) {
             parsedDate = parse(dateStr, 'M/d/yyyy', new Date());
             // Fallback for tricky mm/dd/yyyy formatting without strict matching
             if (isNaN(parsedDate.getTime())) {
                 parsedDate = new Date(dateStr);
             }
          } else {
             parsedDate = new Date(dateStr);
          }
          
          if (isNaN(parsedDate.getTime())) continue;

          let y = parsedDate.getFullYear();
          if (y < 100) parsedDate.setFullYear(2000 + y);
          if (parsedDate.getFullYear() < 2000) parsedDate.setFullYear(parsedDate.getFullYear() + 2000); // e.g. 0025 -> 2025

          finalDate = format(parsedDate, 'yyyy-MM-dd');
       } catch (e) {
          continue; // If date parsing fails, skip
       }

       // Find user by enrollId
       const userMatch = await prisma.user.findFirst({ where: { enrollId: { equals: enrollId } } });
       if (!userMatch) continue; // If we can't find them, skip mapping.

       await prisma.leaveRecord.upsert({
          where: {
            userId_date: {
              userId: userMatch.id,
              date: finalDate
            }
          },
          update: {
            type: leaveType
          },
          create: {
            userId: userMatch.id,
            date: finalDate,
            type: leaveType
          }
       });
       createdOrUpdated++;
    }

    // Recalculate LeaveBalance for all users and all affected years
    // Get unique years from the inserted data
    const affectedYears = Array.from(new Set(
       data.map((row: any) => {
          let dateStr = '';
          for (const key of Object.keys(row)) {
             if (key.toLowerCase().includes('date')) dateStr = String(row[key]);
          }
          if (!dateStr) return null;
          try {
             let d = dateStr.includes('/') ? parse(dateStr, 'M/d/yyyy', new Date()) : new Date(dateStr);
             if (isNaN(d.getTime())) d = new Date(dateStr);
             let y = d.getFullYear();
             if (y < 100) return 2000 + y;
             if (y < 2000) return y + 2000;
             return y;
          } catch { return null; }
       }).filter(y => y !== null)
    )) as number[];

    if (affectedYears.length === 0) {
      affectedYears.push(new Date().getFullYear());
    }

    const users = await prisma.user.findMany();

    for (const user of users) {
       for (const year of affectedYears) {
          const userLeaves = await prisma.leaveRecord.findMany({
             where: {
                userId: user.id,
                date: { startsWith: String(year) }
             }
          });

          // Allow 0ing out a balance if they originally had some records that were deleted/moved
          let planned = 0, emergency = 0, lop = 0, pending = 0, total = 0;
          for (const rec of userLeaves) {
             if (rec.type === 'PL') planned++;
             else if (rec.type === 'EL') emergency++;
             else if (rec.type === 'LOP') lop++;
             else pending++;
             total++;
          }

          if (userLeaves.length > 0 || (await prisma.leaveBalance.findUnique({ where: { userId_year: { userId: user.id, year } } }))) {
              await prisma.leaveBalance.upsert({
                 where: {
                   userId_year: { userId: user.id, year }
                 },
                 update: { planned, emergency, lop, pending, total },
                 create: { userId: user.id, year, planned, emergency, lop, pending, total }
              });
          }
       }
    }

    return NextResponse.json({ success: true, count: createdOrUpdated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process file' }, { status: 500 });
  }
}
