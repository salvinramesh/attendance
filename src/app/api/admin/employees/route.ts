import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const data = await req.json();
  try {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newEmp = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        dept: data.dept || null,
        enrollId: data.enrollId,
        role: 'EMPLOYEE'
      }
    });
    // Remove password before sending
    const { password: _, ...empWithoutPassword } = newEmp;
    return NextResponse.json(empWithoutPassword);
  } catch (error) {
    return NextResponse.json({ error: 'Registration Failed. Username or Enroll ID might already exist.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    // Delete associated logs first or configure cascade delete in schema. Without cascade, we must delete manually:
    const userId = parseInt(id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.enrollId) {
       // Optional: We can choose to keep AttendanceLogs or delete them. We will keep AttendanceLogs as they map by string. 
       // But WFH logs are strongly linked by foreign key 'userId'.
       await prisma.wFHLog.deleteMany({ where: { userId } });
    }
    
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Deletion Failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const data = await req.json();
  const { id, username, name, dept, enrollId, password } = data;
  
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    const updateData: any = { username, name, dept, enrollId };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    const { password: _, ...empWithoutPassword } = updated;
    return NextResponse.json(empWithoutPassword);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Update failed. Username or Enroll ID may already be in use.' }, { status: 500 });
  }
}
