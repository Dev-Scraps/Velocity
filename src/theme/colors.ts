export const AppColors = {
  black: '#0A0A0A',
  white: '#FFFFFF',

  primaryRed: '#FF0033',
  primaryPink: '#FF1744',
  primaryOrange: '#FF6B35',

  primaryPurple: '#7C4DFF',
  primaryViolet: '#9C27B0',
  primaryIndigo: '#5E35B1',

  primaryBlue: '#448AFF',
  primarySky: '#00B0FF',
  primaryNavy: '#304FFE',

  primaryGreen: '#00E676',
  primaryTeal: '#1DE9B6',
  primaryEmerald: '#00C853',

  primaryAmber: '#FFAB00',
  primaryDeepOrange: '#FF6D00',

  primaryLime: '#AEEA00',
  primaryCyan: '#00E5FF',
  primaryRose: '#FF1744',
  primarySlate: '#546E7A',
  primaryMagenta: '#E91E63',

  accentPurple: '#7C4DFF',
  accentBlue: '#448AFF',
  accentCyan: '#00E5FF',
  accentTeal: '#1DE9B6',
  accentGreen: '#00E676',
  accentPink: '#FF4081',
  accentOrange: '#FF6B35',

  lightBackground: '#F8F9FA',
  darkBackground: '#0A0A0A',

  lightSurface: '#FFFFFF',
  darkSurface: '#1A1A1A',
  darkSurfaceVariant: '#252525',

  lightText: '#0A0A0A',
  darkText: '#FFFFFF',
  lightTextSecondary: '#666666',
  darkTextSecondary: '#B0B0B0',

  error: '#FF1744',
  success: '#00E676',
  warning: '#FFAB00',
  info: '#448AFF',

  blackTranslucent: 'rgba(0, 0, 0, 0.5)',
  whiteTranslucent: 'rgba(255, 255, 255, 0.125)',

  primary: '#FF0033',
  primaryDark: '#CC0029',
  primaryLight: '#FF1744',
  accent: '#7C4DFF',

  secondaryRed: '#FF6B6B',
  secondaryPink: '#FF8A80',
  secondaryOrange: '#FFB74D',

  secondaryPurple: '#B388FF',
  secondaryViolet: '#CE93D8',
  secondaryIndigo: '#9FA8DA',

  secondaryBlue: '#82B1FF',
  secondarySky: '#80D8FF',
  secondaryNavy: '#8C9EFF',

  secondaryGreen: '#B9F6CA',
  secondaryTeal: '#A7FFEB',
  secondaryEmerald: '#69F0AE',

  secondaryAmber: '#FFE57F',
  secondaryDeepOrange: '#FF9E80',

  secondaryLime: '#CCFF90',
  secondaryCyan: '#84FFFF',
  secondaryRose: '#FF8A80',
  secondarySlate: '#90A4AE',
  secondaryMagenta: '#F48FB1',
} as const;

export type ThemeMode = 'light' | 'dark' | 'system';

export const getPrimaryColor = (themeName: string): string => {
  switch (themeName.toLowerCase()) {
    case 'red':
      return AppColors.primaryRed;
    case 'purple':
      return AppColors.primaryPurple;
    case 'blue':
      return AppColors.primaryBlue;
    case 'green':
      return AppColors.primaryGreen;
    case 'orange':
      return AppColors.primaryAmber;
    case 'teal':
      return AppColors.primaryTeal;
    case 'pink':
      return AppColors.primaryPink;
    case 'lime':
      return AppColors.primaryLime;
    case 'cyan':
      return AppColors.primaryCyan;
    case 'rose':
      return AppColors.primaryRose;
    case 'slate':
      return AppColors.primarySlate;
    case 'magenta':
      return AppColors.primaryMagenta;
    case 'indigo':
      return AppColors.primaryIndigo;
    default:
      return AppColors.primaryRed;
  }
};

export const getSecondaryColor = (themeName: string): string => {
  switch (themeName.toLowerCase()) {
    case 'red':
      return AppColors.secondaryRed;
    case 'purple':
      return AppColors.secondaryPurple;
    case 'blue':
      return AppColors.secondaryBlue;
    case 'green':
      return AppColors.secondaryGreen;
    case 'orange':
      return AppColors.secondaryAmber;
    case 'teal':
      return AppColors.secondaryTeal;
    case 'pink':
      return AppColors.secondaryPink;
    case 'lime':
      return AppColors.secondaryLime;
    case 'cyan':
      return AppColors.secondaryCyan;
    case 'rose':
      return AppColors.secondaryRose;
    case 'slate':
      return AppColors.secondarySlate;
    case 'magenta':
      return AppColors.secondaryMagenta;
    case 'indigo':
      return AppColors.secondaryIndigo;
    default:
      return AppColors.secondaryRed;
  }
};
