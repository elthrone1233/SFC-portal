import React from 'react';

interface PhilHealthLogoProps {
  className?: string;
  size?: number | string;
}

export const PhilHealthLogo: React.FC<PhilHealthLogoProps> = ({ className = 'h-10 w-10', size }) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 400 400"
      className={`${className} shrink-0`}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Left Person - Yellow Front */}
        <linearGradient id="ph-lh-yellow-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF200" />
          <stop offset="100%" stopColor="#E5A900" />
        </linearGradient>
        {/* Left Person - Yellow Side / Shadow */}
        <linearGradient id="ph-lh-yellow-side" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E2A600" />
          <stop offset="100%" stopColor="#A87500" />
        </linearGradient>
        {/* Right Person - Green Front */}
        <linearGradient id="ph-lh-green-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00A74F" />
          <stop offset="100%" stopColor="#007936" />
        </linearGradient>
        {/* Right Person - Green Side / Shadow */}
        <linearGradient id="ph-lh-green-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#007F3B" />
          <stop offset="100%" stopColor="#005B26" />
        </linearGradient>
        {/* Sphere heads - glossy metallic 3D look with gradient highlight */}
        <radialGradient id="ph-sphere-grad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="25%" stopColor="#E5E5E5" />
          <stop offset="65%" stopColor="#777777" />
          <stop offset="100%" stopColor="#222222" />
        </radialGradient>
        {/* Drop shadow filter for premium finish */}
        <filter id="ph-soft-shadow" x="-10%" y="-10%" width="125%" height="125%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>

      <g filter="url(#ph-soft-shadow)">
        {/* 1. LEFT YELLOW PILLAR (3D isometric body resembling person) */}
        {/* Front Face */}
        <path d="M 120 120 L 170 145 L 170 340 L 120 315 Z" fill="url(#ph-lh-yellow-front)" />
        {/* Side Face (Right) */}
        <path d="M 170 145 L 210 125 L 210 245 L 170 265 Z" fill="url(#ph-lh-yellow-side)" />
        {/* Connector Piece / Bridge on Yellow Column */}
        <path d="M 170 215 L 210 245 L 170 265 Z" fill="#D29900" />

        {/* 2. RIGHT GREEN PILLAR (3D isometric body resembling person) */}
        {/* Side Face (Left) */}
        <path d="M 210 185 L 250 160 L 250 315 L 210 340 Z" fill="url(#ph-lh-green-side)" />
        {/* Front Face */}
        <path d="M 250 160 L 290 180 L 290 315 L 250 295 Z" fill="url(#ph-lh-green-front)" />
        {/* Connection bridging between the two pillars */}
        <path d="M 210 245 L 250 215 L 210 185 Z" fill="#00642C" />

        {/* 3. GLOSSY METALLIC SPHERE HEADS */}
        {/* Left head over yellow body */}
        <circle cx="145" cy="70" r="38" fill="url(#ph-sphere-grad)" />
        {/* Right head over green body */}
        <circle cx="250" cy="125" r="32" fill="url(#ph-sphere-grad)" />
      </g>
    </svg>
  );
};
