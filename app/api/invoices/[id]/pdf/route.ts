import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/settings';
import { renderQuotationPdf } from '@/lib/pdf';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response('برای دریافت فایل باید وارد سامانه شوید.', { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const paperSize = url.searchParams.get('paper') === 'A5' ? 'A5' : 'A4';

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { rowIndex: 'asc' } } },
  });

  if (!quotation) return new Response('پیش‌فاکتور یافت نشد.', { status: 404 });
  if (user.role !== 'ADMIN' && quotation.createdById !== user.id) {
    return new Response('دسترسی به این سند مجاز نیست.', { status: 403 });
  }

  const company = await getCompanySettings();

  try {
    const pdf = await renderQuotationPdf(quotation, company, { paperSize });
    const asciiNumber = quotation.number.replace(/[^A-Za-z0-9._-]/g, '_') || quotation.id;
    const fileName = `invoice-${asciiNumber}-${paperSize}.pdf`;

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'QUOTATION_PDF',
      entityType: 'quotation',
      entityId: quotation.id,
      summary: `دریافت PDF پیش‌فاکتور ${quotation.number} (${paperSize})`,
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(`invoice-${quotation.number}-${paperSize}.pdf`)}`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('pdf generation failed', error);
    return new Response('تولید فایل PDF با خطا مواجه شد.', { status: 500 });
  }
}
