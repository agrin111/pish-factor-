import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatJalali,
  isValidJalali,
  jalaliToDate,
  parseJalaliInput,
  toJalali,
} from '@/lib/jalali';

describe('تبدیل تاریخ شمسی', () => {
  it('نوروز ۱۴۰۳ برابر ۲۰ مارس ۲۰۲۴ است', () => {
    const date = jalaliToDate(1403, 1, 1);
    expect(date.toISOString().slice(0, 10)).toBe('2024-03-20');
    const back = toJalali(date);
    expect(back).toEqual({ jy: 1403, jm: 1, jd: 1 });
  });

  it('تبدیل رفت و برگشت برای چند تاریخ', () => {
    const samples = [
      [1400, 12, 29],
      [1401, 6, 31],
      [1405, 8, 28],
      [1404, 2, 15],
    ];
    for (const [jy, jm, jd] of samples) {
      const date = jalaliToDate(jy, jm, jd);
      expect(toJalali(date)).toEqual({ jy, jm, jd });
    }
  });

  it('ورودی فارسی را تجزیه می‌کند', () => {
    const parsed = parseJalaliInput('۱۴۰۵/۰۸/۲۸');
    expect(parsed).not.toBeNull();
    expect(parsed!.toISOString().slice(0, 10)).toBe('2026-11-19');
  });

  it('ورودی نامعتبر رد می‌شود', () => {
    expect(parseJalaliInput('1405/13/01')).toBeNull();
    expect(parseJalaliInput('1405/07/31')).toBeNull();
    expect(parseJalaliInput('abc')).toBeNull();
  });

  it('اعتبارسنجی تاریخ', () => {
    expect(isValidJalali(1405, 8, 28)).toBe(true);
    expect(isValidJalali(1405, 12, 30)).toBe(false);
  });

  it('قالب‌بندی با ارقام فارسی', () => {
    const label = formatJalali(jalaliToDate(1405, 8, 28));
    expect(label).toBe('۱۴۰۵/۰۸/۲۸');
  });

  it('افزودن روز', () => {
    const base = jalaliToDate(1405, 8, 28);
    expect(formatJalali(addDays(base, 7))).toBe('۱۴۰۵/۰۹/۰۵');
  });
});
