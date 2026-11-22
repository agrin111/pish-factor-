import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIp, getSessionUser } from '@/lib/auth';
import { getCompanySettings, resolveLetterhead } from '@/lib/settings';
import { renderQuotationPdf } from '@/lib/pdf';
import { buildInvoicePdfFileName } from '@/lib/pdf-filename';
import { quotationEmailSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: 'برای ارسال ایمیل باید وارد سامانه شوید.' },
      { status: 401 },
    );
  }

  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { rowIndex: 'asc' } } },
  });

  if (!quotation) {
    return NextResponse.json({ ok: false, message: 'پیش‌فاکتور یافت نشد.' }, { status: 404 });
  }
  if (user.role !== 'ADMIN' && quotation.createdById !== user.id) {
    return NextResponse.json({ ok: false, message: 'دسترسی به این سند مجاز نیست.' }, { status: 403 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'فرمت درخواست نامعتبر است.' }, { status: 400 });
  }

  const parsed = quotationEmailSchema.safeParse(bodyJson);
  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? 'اطلاعات ایمیل معتبر نیست.';
    return NextResponse.json({ ok: false, message: firstError }, { status: 400 });
  }

  const company = await getCompanySettings();
  if (!company.smtpHost || !company.smtpUser || !company.smtpPass) {
    return NextResponse.json(
      {
        ok: false,
        needsSmtpConfig: true,
        message:
          'تنظیمات ارسال مستقیم ایمیل (SMTP) هنوز در بخش «تنظیمات شرکت» وارد نشده است.',
      },
      { status: 400 },
    );
  }

  try {
    const pdf = await renderQuotationPdf(quotation, company, {
      paperSize: parsed.data.paperSize,
    });
    const letterhead = resolveLetterhead(company, quotation.letterheadType ?? 'MAIN');
    const fileName = buildInvoicePdfFileName({
      customerName: quotation.customerName,
      issueDate: quotation.issueDate,
      documentNumber: quotation.number,
      paperSize: parsed.data.paperSize,
    });

    const port = company.smtpPort ?? 587;
    const transporter = nodemailer.createTransport({
      host: company.smtpHost,
      port,
      secure: company.smtpSecure || port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: {
        user: company.smtpUser,
        pass: company.smtpPass,
      },
    });

    const fromAddress = company.smtpFrom || company.smtpUser;
    const safeCompanyName = letterhead.companyName.replace(/"/g, '');

    await transporter.sendMail({
      from: `"${safeCompanyName}" <${fromAddress}>`,
      to: parsed.data.to,
      subject: parsed.data.subject,
      text: parsed.data.body,
      attachments: [
        {
          filename: fileName,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'QUOTATION_EMAIL',
      entityType: 'quotation',
      entityId: quotation.id,
      summary: `ارسال ایمیل پیش‌فاکتور ${quotation.number} (${parsed.data.paperSize}) به ${parsed.data.to}`,
      ipAddress: await getClientIp(),
    });

    return NextResponse.json({
      ok: true,
      message: `پیش‌فاکتور همراه با فایل PDF (${parsed.data.paperSize}) با موفقیت به ${parsed.data.to} ارسال شد.`,
    });
  } catch (error) {
    console.error('email send failed', error);
    const detail = error instanceof Error ? error.message : '';
    return NextResponse.json(
      {
        ok: false,
        message:
          detail.includes('Invalid login') || detail.includes('535')
            ? 'نام کاربری یا رمز عبور SMTP اشتباه است (در جیمیل از App Password استفاده کنید).'
            : 'ارسال ایمیل با خطا مواجه شد. اتصال اینترنت و تنظیمات SMTP را بررسی کنید.',
      },
      { status: 500 },
    );
  }
}
