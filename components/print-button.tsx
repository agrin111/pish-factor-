'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { printCurrentDocument, type PaperSize } from '@/lib/print-and-pdf';

interface Props {
  label?: string;
  className?: string;
  paperSize?: PaperSize;
  showPaperSelector?: boolean;
  onPaperSizeChange?: (size: PaperSize) => void;
}

export function PrintButton({
  label = 'چاپ سند',
  className = 'btn btn-secondary',
  paperSize: controlledSize,
  showPaperSelector = false,
  onPaperSizeChange,
}: Props) {
  const [internalSize, setInternalSize] = useState<PaperSize>('A4');
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  const paperSize = controlledSize ?? internalSize;

  const setPaperSize = (next: PaperSize) => {
    setInternalSize(next);
    onPaperSizeChange?.(next);
  };

  const handlePrint = async () => {
    setError('');
    setPrinting(true);
    try {
      const result = await printCurrentDocument(paperSize);
      if (!result.ok && !result.canceled && result.error) {
        setError(result.error);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      {showPaperSelector && (
        <div
          className="inline-flex items-center rounded-lg border border-[#D7DEE5] bg-white p-0.5 text-xs"
          role="group"
          aria-label="انتخاب اندازه برگه"
        >
          <button
            type="button"
            onClick={() => setPaperSize('A4')}
            className={`rounded-md px-2.5 py-1 font-semibold transition ${
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
            className={`rounded-md px-2.5 py-1 font-semibold transition ${
              paperSize === 'A5'
                ? 'bg-[#172535] text-white'
                : 'text-[#4A5A6A] hover:text-[#172535]'
            }`}
          >
            A5
          </button>
        </div>
      )}

      <button type="button" className={className} onClick={handlePrint} disabled={printing}>
        <Printer className="h-4 w-4" />
        {printing ? 'در حال ارسال...' : label}
      </button>

      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
