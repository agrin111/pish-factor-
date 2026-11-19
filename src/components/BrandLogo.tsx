import React from 'react';

interface BrandLogoProps {
  logoDataUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoDataUrl,
  size = 'md',
  variant = 'dark',
}) => {
  const dims =
    size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (logoDataUrl && logoDataUrl.trim().length > 0) {
    return (
      <img
        src={logoDataUrl}
        alt="لوگوی شرکت آهن آگرین"
        referrerPolicy="no-referrer"
        className={`${dims} object-contain rounded-lg bg-white p-1 border border-[#D7DEE5] shrink-0`}
      />
    );
  }

  const strokeColor = variant === 'light' ? '#FFFFFF' : '#172535';
  const accentColor = '#347C65';

  return (
    <div
      className={`${dims} rounded-lg flex items-center justify-center shrink-0 ${
        variant === 'light'
          ? 'bg-white/10 border border-white/15'
          : 'bg-[#172535]/5 border border-[#D7DEE5]'
      }`}
    >
      <svg
        viewBox="0 0 36 36"
        className="w-2/3 h-2/3"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Geometric Steel I-Beam Mark */}
        <path
          d="M7 7H29V11H21V25H29V29H7V25H15V11H7V7Z"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <rect x="16.5" y="13" width="3" height="10" rx="1" fill={accentColor} />
      </svg>
    </div>
  );
};
