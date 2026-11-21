'use client';

import { useEffect, useState } from 'react';
import { toEnglishDigits, toPersianDigits } from '@/lib/format';

interface NumberFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'defaultValue' | 'dir'
  > {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  allowDecimal?: boolean;
}

/**
 * ورودی عددی با نمایش ارقام فارسی.
 * مقدار واقعی (state یا مقدار فرم) همیشه لاتین است تا محاسبه و ارسال به سرور
 * دقیق بماند؛ تنها چیزی که کاربر می‌بیند ارقام فارسی است.
 */
export function NumberField({
  value,
  defaultValue,
  onValueChange,
  allowDecimal = true,
  className,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = useState(() => toPersianDigits(value ?? defaultValue ?? ''));

  useEffect(() => {
    if (value !== undefined) setText(toPersianDigits(value));
  }, [value]);

  const handleChange = (raw: string) => {
    let latin = toEnglishDigits(raw).replace(/\s/g, '');
    latin = allowDecimal ? latin.replace(/[^\d.]/g, '') : latin.replace(/\D/g, '');
    if (allowDecimal) {
      const [whole, ...decimals] = latin.split('.');
      latin = decimals.length > 0 ? `${whole}.${decimals.join('')}` : whole;
    }
    setText(toPersianDigits(latin));
    onValueChange?.(latin);
  };

  return (
    <input
      {...rest}
      type="text"
      dir="ltr"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      className={className}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}
