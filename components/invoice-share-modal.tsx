'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Mail,
  MessageCircle,
  Send,
  Share2,
} from 'lucide-react';
import { Modal } from '@/components/modal';
import {
  buildBaleUrl,
  buildInvoiceShareText,
  buildMailtoUrl,
  buildTelegramDirectUrl,
  buildTelegramShareUrl,
  buildWhatsAppUrl,
  type ShareQuotationData,
} from '@/lib/share';
import {
  canUseNativeFileShare,
  copyTextToClipboard,
  openExternalShareUrl,
  prepareSharePdfFile,
  sharePdfWithSystemSheet,
  triggerBrowserPdfDownload,
  type PaperSize,
} from '@/lib/print-and-pdf';
import { formatDocumentNumber } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  quotationId: string;
  documentNumber: string;
  initialData?: ShareQuotationData;
  initialPaperSize?: PaperSize;
}

export function InvoiceShareModal({
  open,
  onClose,
  quotationId,
  documentNumber,
  initialData,
  initialPaperSize = 'A4',
}: Props) {
  const [data, setData] = useState<ShareQuotationData | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>(initialPaperSize);
  const [phone, setPhone] = useState(initialData?.customerMobile ?? '');
  const [email, setEmail] = useState('');
  const [messageText, setMessageText] = useState(
    initialData ? buildInvoiceShareText(initialData) : '',
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [preparedPath, setPreparedPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
    needsSmtpConfig?: boolean;
  } | null>(null);

  useEffect(() => {
    setPaperSize(initialPaperSize);
  }, [initialPaperSize]);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setPreparedPath(null);

    if (initialData) {
      setData(initialData);
      setPhone(initialData.customerMobile);
      setMessageText(buildInvoiceShareText(initialData));
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/invoices/${encodeURIComponent(quotationId)}/share-info`, {
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || 'بارگذاری اطلاعات پیش‌فاکتور انجام نشد.');
        }
        if (!cancelled) {
          const loaded = json.data as ShareQuotationData;
          setData(loaded);
          setPhone(loaded.customerMobile);
          setMessageText(buildInvoiceShareText(loaded));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFeedback({
            ok: false,
            message: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات سند.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, quotationId, initialData]);

  const emailSubject = data
    ? `پیش‌فاکتور شماره ${formatDocumentNumber(data.number)} — ${data.companyName}`
    : `پیش‌فاکتور ${formatDocumentNumber(documentNumber)}`;

  const ensurePdfPrepared = async (downloadInBrowserIfNoDesktop: boolean) => {
    const res = await prepareSharePdfFile(quotationId, documentNumber, paperSize);
    if (!res.ok || !res.bytes || !res.fileName) {
      setFeedback({ ok: false, message: res.error || 'تولید فایل PDF انجام نشد.' });
      return null;
    }
    if (res.filePath) {
      setPreparedPath(res.filePath);
    } else if (downloadInBrowserIfNoDesktop) {
      triggerBrowserPdfDownload(res.bytes, res.fileName);
    }
    return res;
  };

  const handleCopyText = async () => {
    const ok = await copyTextToClipboard(messageText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setFeedback({ ok: false, message: 'کپی متن در کلیپ‌بورد انجام نشد.' });
    }
  };

  const handlePrepareOnly = async () => {
    setFeedback(null);
    setBusyAction('prepare');
    try {
      const prepared = await ensurePdfPrepared(true);
      if (prepared) {
        setFeedback({
          ok: true,
          message: prepared.filePath
            ? `فایل PDF (${paperSize}) برای ارسال آماده شد و در پوشه خروجی ذخیره گردید.`
            : `فایل PDF (${paperSize}) دانلود شد و آماده پیوست در پیام‌رسان است.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleMessengerShare = async (channel: 'whatsapp' | 'telegram' | 'telegram-direct' | 'bale') => {
    setFeedback(null);
    setBusyAction(channel);
    try {
      await copyTextToClipboard(messageText);
      const prepared = await ensurePdfPrepared(true);

      let targetUrl = '';
      if (channel === 'whatsapp') {
        targetUrl = buildWhatsAppUrl(phone, messageText);
      } else if (channel === 'telegram') {
        targetUrl = buildTelegramShareUrl(messageText);
      } else if (channel === 'telegram-direct') {
        targetUrl = buildTelegramDirectUrl(phone) || buildTelegramShareUrl(messageText);
      } else {
        targetUrl = buildBaleUrl();
      }

      const opened = await openExternalShareUrl(targetUrl);
      if (!opened) {
        setFeedback({
          ok: false,
          message: 'باز کردن برنامه یا لینک پیام‌رسان با خطا مواجه شد.',
        });
        return;
      }

      const channelTitle =
        channel === 'whatsapp'
          ? 'واتساپ'
          : channel === 'bale'
            ? 'بله'
            : 'تلگرام';

      setFeedback({
        ok: true,
        message: prepared?.filePath
          ? `${channelTitle} باز شد، متن پیش‌فاکتور کپی شد و فایل PDF آماده پیوست است (از دکمه «نمایش فایل در پوشه» می‌توانید فایل را بکشید و رها کنید).`
          : `${channelTitle} باز شد و متن پیش‌فاکتور کپی شد. فایل PDF نیز دانلود شد تا در گفتگو پیوست کنید.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSystemFileShare = async () => {
    setFeedback(null);
    setBusyAction('system');
    try {
      const prepared = await ensurePdfPrepared(false);
      if (!prepared?.bytes || !prepared.fileName) return;
      const res = await sharePdfWithSystemSheet(
        prepared.bytes,
        prepared.fileName,
        emailSubject,
        messageText,
      );
      if (res.unsupported) {
        setFeedback({
          ok: false,
          message: 'مرورگر فعلی از اشتراک‌گذاری مستقیم فایل پشتیبانی نمی‌کند؛ از دکمه‌های زیر استفاده کنید.',
        });
      } else if (res.error) {
        setFeedback({ ok: false, message: res.error });
      } else if (res.ok) {
        setFeedback({ ok: true, message: 'فایل PDF با موفقیت به برنامه انتخابی ارسال شد.' });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendDirectEmail = async () => {
    setFeedback(null);
    if (!email.trim()) {
      setFeedback({ ok: false, message: 'لطفاً آدرس ایمیل گیرنده را وارد کنید.' });
      return;
    }
    setBusyAction('smtp');
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(quotationId)}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          to: email.trim(),
          subject: emailSubject,
          body: messageText,
          paperSize,
        }),
      });
      const json = await res.json().catch(() => ({}));
      setFeedback({
        ok: Boolean(res.ok && json?.ok),
        message: json?.message || 'ارسال ایمیل با خطا مواجه شد.',
        needsSmtpConfig: Boolean(json?.needsSmtpConfig),
      });
    } catch {
      setFeedback({ ok: false, message: 'خطا در ارتباط با سرور برای ارسال ایمیل.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleMailtoClient = async () => {
    setFeedback(null);
    setBusyAction('mailto');
    try {
      const prepared = await ensurePdfPrepared(true);
      const url = buildMailtoUrl(email, emailSubject, messageText);
      await openExternalShareUrl(url);
      setFeedback({
        ok: true,
        message: prepared?.filePath
          ? 'برنامه ایمیل سیستم با متن پیش‌فاکتور باز شد و فایل PDF برای پیوست آماده است.'
          : 'برنامه ایمیل سیستم باز شد و فایل PDF دانلود گردید تا در ایمیل پیوست کنید.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const showNativeShare = canUseNativeFileShare();
  const telegramDirectUrl = buildTelegramDirectUrl(phone);
  const isDesktop = typeof window !== 'undefined' && Boolean(window.pishfactorDesktop?.isDesktop);

  return (
    <Modal open={open} onClose={onClose} title="اشتراک‌گذاری و ارسال پیش‌فاکتور">
      <div className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-xs text-[#6B7A88]">
            در حال آماده‌سازی اطلاعات پیش‌فاکتور...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7DEE5] bg-[#F7F9FA] px-3 py-2.5">
              <div className="text-xs">
                <span className="font-semibold">اندازه فایل PDF برای ارسال:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-[#D7DEE5] bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaperSize('A4')}
                    className={`rounded-md px-2.5 py-1 font-bold transition ${
                      paperSize === 'A4'
                        ? 'bg-[#172535] text-white'
                        : 'text-[#4A5A6A] hover:text-[#172535]'
                    }`}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize('A5')}
                    className={`rounded-md px-2.5 py-1 font-bold transition ${
                      paperSize === 'A5'
                        ? 'bg-[#172535] text-white'
                        : 'text-[#4A5A6A] hover:text-[#172535]'
                    }`}
                  >
                    A5
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrepareOnly}
                  disabled={busyAction !== null}
                  className="btn btn-secondary btn-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  {busyAction === 'prepare' ? 'در حال ساخت...' : `آماده‌سازی PDF (${paperSize})`}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="share-phone">
                  شماره موبایل مشتری (واتساپ / تلگرام)
                </label>
                <input
                  id="share-phone"
                  className="input numeric"
                  dir="ltr"
                  placeholder="09123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="share-email">
                  ایمیل گیرنده
                </label>
                <input
                  id="share-email"
                  type="email"
                  className="input"
                  dir="ltr"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0" htmlFor="share-message">
                  متن پیام پیش‌فاکتور (قابل ویرایش)
                </label>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#347C65] hover:underline"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'کپی شد' : 'کپی متن'}
                </button>
              </div>
              <textarea
                id="share-message"
                className="textarea text-xs leading-relaxed"
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#3D4D5D]">ارسال در پیام‌رسان‌ها:</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleMessengerShare('whatsapp')}
                  className="btn justify-center border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  {busyAction === 'whatsapp' ? 'در حال آماده‌سازی...' : 'واتساپ'}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleMessengerShare('telegram')}
                  className="btn justify-center border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
                >
                  <Send className="h-4 w-4" />
                  {busyAction === 'telegram' ? 'در حال آماده‌سازی...' : 'تلگرام'}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleMessengerShare('bale')}
                  className="btn justify-center border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  {busyAction === 'bale' ? 'در حال آماده‌سازی...' : 'پیام‌رسان بله'}
                </button>
              </div>

              {telegramDirectUrl && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleMessengerShare('telegram-direct')}
                  className="text-[11px] font-semibold text-sky-700 hover:underline"
                >
                  یا باز کردن چت مستقیم تلگرام با شماره مشتری ←
                </button>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-[#D7DEE5] bg-[#F9FAFB] p-3">
              <div className="text-xs font-semibold text-[#3D4D5D]">ارسال از طریق ایمیل:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleSendDirectEmail}
                  className="btn btn-primary btn-sm"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {busyAction === 'smtp'
                    ? 'در حال ارسال ایمیل...'
                    : `ارسال مستقیم ایمیل با پیوست PDF (${paperSize})`}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={handleMailtoClient}
                  className="btn btn-secondary btn-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  برنامه ایمیل سیستم
                </button>
              </div>
              {data && !data.smtpConfigured && (
                <p className="text-[11px] text-[#6B7A88]">
                  برای ارسال خودکار ایمیل همراه فایل PDF از داخل برنامه، بخش SMTP را در{' '}
                  <Link href="/settings" onClick={onClose} className="font-semibold text-[#347C65] underline">
                    تنظیمات شرکت
                  </Link>{' '}
                  تکمیل کنید.
                </p>
              )}
            </div>

            {showNativeShare && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleSystemFileShare}
                className="btn btn-navy w-full"
              >
                <Share2 className="h-4 w-4" />
                اشتراک‌گذاری مستقیم فایل PDF با برنامه‌های سیستم
              </button>
            )}

            {preparedPath && isDesktop && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D7DEE5] bg-white px-3 py-2 text-xs">
                <span className="truncate text-[#4A5A6A]" dir="ltr">
                  {preparedPath}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.pishfactorDesktop?.showItemInFolder?.(preparedPath)}
                    className="btn btn-secondary btn-sm"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    نمایش فایل در پوشه
                  </button>
                  <button
                    type="button"
                    onClick={() => window.pishfactorDesktop?.openFilePath?.(preparedPath)}
                    className="btn btn-secondary btn-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    باز کردن PDF
                  </button>
                </div>
              </div>
            )}

            {feedback && (
              <div
                className={`rounded-xl border p-3 text-xs leading-relaxed ${
                  feedback.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                <p>{feedback.message}</p>
                {feedback.needsSmtpConfig && (
                  <p className="mt-1">
                    <Link
                      href="/settings"
                      onClick={onClose}
                      className="font-semibold underline"
                    >
                      رفتن به تنظیمات شرکت برای تکمیل SMTP ←
                    </Link>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
