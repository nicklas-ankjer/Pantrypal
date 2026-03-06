export const colors = {
  // Primary palette - Kitchen counter aesthetic
  background: '#FBF7F4',
  cardBackground: '#FFFFFF',
  primary: '#7CB342',
  primaryLight: '#AED581',
  primaryDark: '#558B2F',
  
  // Text colors
  textPrimary: '#3E2723',
  textSecondary: '#6D4C41',
  textMuted: '#A1887F',
  
  // Status colors
  success: '#7CB342',
  warning: '#FFB74D',
  danger: '#E57373',
  info: '#64B5F6',
  
  // Wood-inspired tones
  wood: '#D7CCC8',
  woodDark: '#BCAAA4',
  
  // Other
  border: '#EFEBE9',
  divider: '#E0E0E0',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textMuted,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};
