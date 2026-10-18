import React from 'react';

interface BoutiqueLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'vertical';
  className?: string;
  isInSidebar?: boolean;
}

export const BoutiqueLogo: React.FC<BoutiqueLogoProps> = ({
  size = 'md',
  variant = 'full',
  className = '',
  isInSidebar = false
}) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  const textSizes = {
    sm: { title: 'text-sm', sub: 'text-[9px]' },
    md: { title: 'text-base', sub: 'text-[10px]' },
    lg: { title: 'text-xl', sub: 'text-xs' },
    xl: { title: 'text-2xl', sub: 'text-sm' }
  };

  // Modern Clean Commercial Management Icon
  const renderIcon = () => (
    <div
      className={`relative ${iconSizes[size]} shrink-0 rounded-xl ${
        isInSidebar ? 'bg-[#176B52] text-white border border-white/15' : 'bg-[#176B52] text-white'
      } p-2 shadow-sm flex items-center justify-center transition-all duration-200`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        {/* Store storefront roof & structure */}
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex ${className}`}>{renderIcon()}</div>;
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center group ${className}`}>
        {renderIcon()}
        <div className="mt-2.5">
          <div className="flex items-center justify-center gap-1.5">
            <h1
              className={`${textSizes[size].title} font-extrabold tracking-tight uppercase ${
                isInSidebar ? 'text-white' : 'text-[#1F2937]'
              }`}
            >
              MS BAH <span className={isInSidebar ? 'text-white/90' : 'text-[#176B52]'}>PARFUM</span>
            </h1>
          </div>
          <p
            className={`${textSizes[size].sub} font-medium tracking-wide mt-0.5 ${
              isInSidebar ? 'text-white/70' : 'text-[#64748B]'
            }`}
          >
            Parfumerie & Gestion Commerciale
          </p>
        </div>
      </div>
    );
  }

  // Full Horizontal Variant (Default)
  return (
    <div className={`flex items-center gap-3 group select-none ${className}`}>
      {renderIcon()}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`${textSizes[size].title} font-extrabold tracking-tight uppercase leading-none ${
              isInSidebar ? 'text-white' : 'text-[#1F2937]'
            }`}
          >
            MS BAH
          </span>
          <span
            className={`${textSizes[size].title} font-black tracking-tight uppercase leading-none ${
              isInSidebar ? 'text-white' : 'text-[#176B52]'
            }`}
          >
            PARFUM
          </span>
        </div>
        <p
          className={`${textSizes[size].sub} font-medium tracking-wide mt-1 truncate ${
            isInSidebar ? 'text-white/75' : 'text-[#64748B]'
          }`}
        >
          Parfumerie & Articles Divers
        </p>
      </div>
    </div>
  );
};

export default BoutiqueLogo;
