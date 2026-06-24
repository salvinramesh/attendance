import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  try {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newEmp = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        dept: data.dept || null,
        enrollId: data.enrollId || null,
        role: 'EMPLOYEE'
      }
    });
    // Remove password before sending
    const { password: _, ...empWithoutPassword } = newEmp;
    return NextResponse.json(empWithoutPassword);
  } catch (error) {
    return NextResponse.json({ error: 'Registration Failed. Username might already exist.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const { id, username, name, dept, enrollId, password } = data;
  
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    const updateData: any = { username, name, dept, enrollId: enrollId || null };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    const { password: _, ...empWithoutPassword } = updated;
    return NextResponse.json(empWithoutPassword);
  } catch (error: any) {
    console.error('Employee update error:', error.message, { id, username, enrollId });
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.includes('username')) {
        return NextResponse.json({ error: `Username "${username}" is already in use by another employee.` }, { status: 409 });
      }
      if (Array.isArray(target) && target.includes('enrollId')) {
        return NextResponse.json({ error: `Enroll ID "${enrollId}" is already in use by another employee.` }, { status: 409 });
      }
      return NextResponse.json({ error: 'A unique field value is already in use by another employee.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 });
  }
}
