import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/console-users — list all console admin users
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const consoleUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        enabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ consoleUsers });
  } catch (error) {
    console.error('Failed to fetch console users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/console-users — create a new console admin user
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, username, email, password, enabled } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email && email.trim() ? email.trim() : null;

    // Check unique constraints
    const orConditions: any[] = [{ username: trimmedUsername }];
    if (trimmedEmail) {
      orConditions.push({ email: trimmedEmail });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: orConditions },
    });

    if (existingUser) {
      if (existingUser.username === trimmedUsername) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
      }
      if (trimmedEmail && existingUser.email === trimmedEmail) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        username: trimmedUsername,
        email: trimmedEmail,
        password: hashedPassword,
        enabled: enabled !== false,
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        enabled: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create console user:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/admin/console-users — update console admin user
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, username, email, password, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userId = Number(id);

    // Safety check: currently logged in user cannot disable themselves
    if (userId === admin.id && enabled === false) {
      return NextResponse.json({ error: 'You cannot disable your own account' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    if (password && password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email && email.trim() ? email.trim() : null;

    // Check unique constraints (excluding self)
    const orConditions: any[] = [{ username: trimmedUsername }];
    if (trimmedEmail) {
      orConditions.push({ email: trimmedEmail });
    }

    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: orConditions,
      },
    });

    if (duplicate) {
      if (duplicate.username === trimmedUsername) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
      }
      if (trimmedEmail && duplicate.email === trimmedEmail) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    const updateData: any = {
      name: name.trim(),
      username: trimmedUsername,
      email: trimmedEmail,
      enabled: enabled !== false,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        enabled: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('Failed to update console user:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/admin/console-users — delete console admin user
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');

    if (!idStr) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const userId = Number(idStr);

    // Safety check: currently logged in user cannot delete themselves
    if (userId === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Verify user exists and is ADMIN
    const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToDelete || userToDelete.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Console user not found' }, { status: 404 });
    }

    // Cascade delete is handled if we delete user's dependencies.
    // Console admins don't have biometrics/fingerprints/wfh/leaves, but let's delete safely
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete console user:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
