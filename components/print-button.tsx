'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label = 'چاپ سند' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
