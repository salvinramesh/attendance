import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password, loginType } = await req.json();
    
    // loginType would be 'ADMIN' | 'EMPLOYEE' to ensure they log into correct portal if we strictly separate
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
       return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (loginType && user.role !== loginType) {
       return NextResponse.json({ error: `Not authorized for ${loginType.toLowerCase()} portal` }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    const res = NextResponse.json({ success: true, role: user.role });
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
