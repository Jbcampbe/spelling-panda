import type { ReactNode, SVGProps } from 'react';
import { PANDA_COLOR_HEX, WHITE_FUR_HEX } from '../world/colors';
import type { PandaColor } from '../types';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
}

function Svg({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />
  </Svg>
);
export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H19v-5" />
    <circle cx="12" cy="10" r="2.6" fill="currentColor" stroke="none" />
  </Svg>
);
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
  </Svg>
);
export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8" />
  </Svg>
);
export const VolumeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" fill="currentColor" />
    <path d="M15.5 8.8a4.6 4.6 0 0 1 0 6.4M18.2 6a8.4 8.4 0 0 1 0 12" />
  </Svg>
);
export const VolumeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" fill="currentColor" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const SpeakerIcon = VolumeIcon;
export const BubbleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" />
    <path d="M7.5 9h9M7.5 12.5h5.5" />
  </Svg>
);
export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="m5 12.8 4.6 4.6L19 7.5" />
  </Svg>
);
export const ArrowRightIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M4.5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M19.5 12h-14M11 6l-6 6 6 6" />
  </Svg>
);
export const BackspaceIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7Z" />
    <path d="m12.5 9.5 5 5M17.5 9.5l-5 5" />
  </Svg>
);
export const EnterIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M20 5v7a2 2 0 0 1-2 2H5M9.5 9.5 5 14l4.5 4.5" />
  </Svg>
);
export const DiceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <g fill="currentColor" stroke="none">
      <circle cx="8.5" cy="8.5" r="1.4" />
      <circle cx="15.5" cy="8.5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="8.5" cy="15.5" r="1.4" />
      <circle cx="15.5" cy="15.5" r="1.4" />
    </g>
  </Svg>
);
export const StarIcon = ({ filled = true, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1L3.2 9.6l6.1-.8L12 3.2Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </Svg>
);
export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4.5 19.5h15" />
  </Svg>
);
export const EarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9.5a5 5 0 1 1 9.6 2c-.8 1.9-2.6 2.7-3.1 4.3-.5 1.6-1.4 3-3.1 3-1.7 0-2.6-1.2-2.6-2.7" />
    <path d="M10.5 9.5a1.8 1.8 0 1 1 3.4.8c-.4.7-1.2 1-1.4 1.8" />
  </Svg>
);
export const IslandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13.5c0-1.4 4-2.5 9-2.5s9 1.1 9 2.5c0 2.2-2.6 5.5-9 7.5-6.4-2-9-5.3-9-7.5Z" />
    <path d="M12 11V6.5M12 6.5c-1.6 0-2.8-1-3.2-2.5 1.6-.1 2.8.5 3.2 1.4.4-1.5 1.6-2.4 3.2-2.4-.3 1.6-1.6 3.5-3.2 3.5Z" />
  </Svg>
);
export const SproutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21v-9" />
    <path d="M12 12c0-3.5-2.4-5.5-6-5.5 0 3.6 2.4 5.5 6 5.5Z" fill="currentColor" fillOpacity=".25" />
    <path d="M12 14.5c0-3 2-4.8 5.5-4.8 0 3.2-2 4.8-5.5 4.8Z" fill="currentColor" fillOpacity=".25" />
  </Svg>
);
export const BambooIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21V4.5M9 8.5h0M9 13h0M9 17.5h0" />
    <rect x="6.8" y="3" width="4.4" height="18" rx="2.2" fill="currentColor" fillOpacity=".22" />
    <path d="M6.8 9h4.4M6.8 14.5h4.4" />
    <path d="M11.2 7c2.5-.2 4.5-1.4 5.5-3.5M11.2 12c2.6.3 5-.6 6.6-2.7" />
  </Svg>
);
export const TreeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21v-5.5" />
    <path
      d="M12 3.5c3 0 5 2.3 5 4.7 1.7.7 2.5 2.2 2.5 3.8 0 2.4-2 4-4.2 4H8.7c-2.2 0-4.2-1.6-4.2-4 0-1.600.8-3.100 2.500-3.800 0-2.400 2-4.700 5-4.700Z"
      fill="currentColor"
      fillOpacity=".22"
    />
  </Svg>
);
export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c.6 4.200 1.800 5.400 6 6-4.200.6-5.400 1.800-6 6-.6-4.200-1.800-5.400-6-6 4.200-.6 5.400-1.800 6-6Z" fill="currentColor" />
    <path d="M18.500 15.500c.3 2 .8 2.500 2.500 2.800-1.700.3-2.200.8-2.500 2.700-.3-1.900-.8-2.400-2.500-2.700 1.700-.3 2.200-.8 2.500-2.800Z" fill="currentColor" stroke="none" />
  </Svg>
);
export const WarnIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 21.500 20h-19L12 3.500Z" />
    <path d="M12 10v4.500M12 17.300v.2" />
  </Svg>
);
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.500 11.500 12 4l8.500 7.500M6 10v9.500h12V10" />
  </Svg>
);
export const LeaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4.500H5.500v15H10M14 8l4 4-4 4M18 12H9" />
  </Svg>
);
export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.500v7M14 8.500v7" />
  </Svg>
);

/** Progress-dot glyphs: distinguished by shape, not colour alone (R-UI-4). */
export const DotPending = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.6" />
  </svg>
);
export const DotCorrect = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="m7 12.500 3.500 3.500L17 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const DotMissed = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.500 21.500 12 12 21.500 2.500 12 12 2.500Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2.600" fill="#fff" />
  </svg>
);

/** A simple flat panda face used as a fallback avatar. */
export function PandaFace({ color = 'classic', size = 64 }: { color?: PandaColor; size?: number }) {
  const dark = PANDA_COLOR_HEX[color];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="14" cy="15" r="9" fill={dark} />
      <circle cx="50" cy="15" r="9" fill={dark} />
      <ellipse cx="32" cy="35" rx="23" ry="21" fill={WHITE_FUR_HEX} />
      <ellipse cx="22" cy="32" rx="6.500" ry="8" fill={dark} transform="rotate(20 22 32)" />
      <ellipse cx="42" cy="32" rx="6.500" ry="8" fill={dark} transform="rotate(-20 42 32)" />
      <circle cx="23" cy="31" r="2.200" fill="#fff" />
      <circle cx="41" cy="31" r="2.200" fill="#fff" />
      <ellipse cx="32" cy="41" rx="4.500" ry="3.200" fill={dark} />
      <path d="M27 46c2 2.500 8 2.500 10 0" fill="none" stroke={dark} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
