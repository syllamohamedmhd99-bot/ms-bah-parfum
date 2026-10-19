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

  // Custom Boutique Manager Emblem Logo
  const renderIcon = () => (
    <div
      className={`relative ${iconSizes[size]} shrink-0 rounded-2xl overflow-hidden shadow-md flex items-center justify-center transition-all duration-200 border ${
        isInSidebar ? 'border-white/20 ring-2 ring-emerald-500/20' : 'border-[#176B52]/20'
      }`}
    >
      <img
        src="/logo.png"
        alt="MS BAH PARFUM - Boutique Manager"
        className="w-full h-full object-cover rounded-2xl"
      />
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
