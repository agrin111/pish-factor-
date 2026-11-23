import Image from 'next/image';

interface BrandLogoProps {
  logoDataUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
}

const SIZES = { sm: 34, md: 44, lg: 54 } as const;

export function BrandLogo({ logoDataUrl, size = 'md', variant = 'dark' }: BrandLogoProps) {
  const dimension = SIZES[size];

  if (logoDataUrl) {
    return (
      <span
        className="inline-flex items-center justify-center overflow-hidden rounded-lg bg-white"
        style={{ width: dimension, height: dimension }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoDataUrl}
          alt="لوگوی شرکت"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </span>
    );
  }

  const bg = variant === 'light' ? '#FFFFFF' : '#0F1A24';
  const color = variant === 'light' ? '#0F1A24' : '#FFFFFF';

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg font-extrabold select-none"
      style={{
        width: dimension,
        height: dimension,
        background: bg,
        color,
        fontSize: dimension * 0.36,
        letterSpacing: '-0.02em',
      }}
      aria-label="آهن آگرین"
    >
      آا
    </span>
  );
}

void Image;
