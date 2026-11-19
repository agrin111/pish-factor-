'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, destroySession, getClientIp, verifyPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { ActionState } from '@/lib/forms';
import { fail, zodToState } from '@/lib/forms';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری را وارد کنید.').max(60),
  password: z.string().min(1, 'رمز عبور را وارد کنید.').max(200),
});

/**
 * محدودیت ساده تعداد تلاش ناموفق ورود (در حافظه پروسه).
 * برای استقرار چندنمونه‌ای، محدودسازی در لایه Reverse Proxy نیز توصیه می‌شود.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!parsed.success) return zodToState(parsed.error);

  const username = parsed.data.username.toLowerCase();
  const ip = await getClientIp();
  const limitKey = `${username}|${ip ?? 'unknown'}`;

  if (isRateLimited(limitKey)) {
    return fail('تعداد تلاش‌های ناموفق زیاد است. لطفاً چند دقیقه بعد دوباره تلاش کنید.');
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const valid = user ? verifyPassword(parsed.data.password, user.passwordHash) : false;

  if (!user || !valid) {
    registerFailure(limitKey);
    await logAudit({
      actorName: parsed.data.username,
      action: 'LOGIN_FAILED',
      entityType: 'auth',
      summary: `تلاش ناموفق ورود برای نام کاربری «${parsed.data.username}»`,
      ipAddress: ip,
    });
    return fail('نام کاربری یا رمز عبور نادرست است.');
  }

  if (!user.isActive) {
    return fail('حساب کاربری شما غیرفعال شده است. با مدیر سیستم تماس بگیرید.');
  }

  attempts.delete(limitKey);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id);

  await logAudit({
    actorId: user.id,
    actorName: user.fullName,
    action: 'LOGIN',
    entityType: 'auth',
    entityId: user.id,
    summary: `ورود موفق به سامانه (${user.username})`,
    ipAddress: ip,
  });

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
