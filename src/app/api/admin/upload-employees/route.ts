import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';

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
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    let created = 0;
    
    for (const row of data) {
       // Support variations in header capitalization
       const username = row.username || row.Username;
       const password = row.password || row.Password;
       const name = row.name || row.Name;
       const dept = row.dept || row.Dept || row.Department;
       const enrollId = row.enrollId || row.EnrollId || row['Enroll ID'];

       if (!username || !password || !name) continue;
       
       const existing = await prisma.user.findUnique({ where: { username: String(username) } });
       if (!existing) {
          const hashedPassword = await bcrypt.hash(String(password), 10);
          await prisma.user.create({
            data: {
              username: String(username),
              password: hashedPassword,
              name: String(name),
              dept: dept ? String(dept) : null,
              enrollId: enrollId ? String(enrollId) : null,
              role: 'EMPLOYEE'
            }
          });
          created++;
       }
    }

    return NextResponse.json({ success: true, count: created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process file' }, { status: 500 });
  }
}
