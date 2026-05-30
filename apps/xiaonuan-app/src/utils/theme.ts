/**
 * Warm Companion Design System
 * Source: docs/xiaonuanApp/warm_companion/DESIGN.md
 * Concept: "Digital Empathy" — Soft Minimalist + Tactile
 */

export const colors = {
  surface: '#fcf9f4',
  surfaceDim: '#dcdad5',
  surfaceBright: '#fcf9f4',
  surfaceLowest: '#ffffff',
  surfaceContainerLowest: '#ffffff',
  surfaceLow: '#f6f3ee',
  surfaceContainer: '#f0ede9',
  surfaceContainerHigh: '#ebe8e3',
  surfaceContainerHighest: '#e5e2dd',
  onSurface: '#1c1c19',
  onSurfaceVariant: '#544437',
  inverseSurface: '#31302d',
  inverseOnSurface: '#f3f0eb',
  outline: '#877365',
  outlineVariant: '#dac2b1',
  surfaceTint: '#8f4e00',
  primary: '#8f4e00',
  onPrimary: '#ffffff',
  primaryContainer: '#ff9f43',
  onPrimaryContainer: '#6d3a00',
  inversePrimary: '#ffb77a',
  primaryFixed: '#ffdcc2',
  primaryFixedDim: '#ffb77a',
  onPrimaryFixed: '#2e1500',
  onPrimaryFixedVariant: '#6d3a00',
  secondary: '#5f5e5e',
  onSecondary: '#ffffff',
  secondaryContainer: '#e4e2e1',
  onSecondaryContainer: '#656464',
  tertiary: '#655d55',
  onTertiary: '#ffffff',
  tertiaryContainer: '#bfb4aa',
  onTertiaryContainer: '#4e463e',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#fcf9f4',
  onBackground: '#1c1c19',
  surfaceVariant: '#e5e2dd',
  tertiaryFixed: '#ede0d6',
  tertiaryFixedDim: '#d0c4ba',
  onTertiaryFixed: '#201b14',
  onTertiaryFixedVariant: '#4d453e',
  secondaryFixed: '#e4e2e1',
  secondaryFixedDim: '#c8c6c6',
  onSecondaryFixed: '#1b1c1c',
  onSecondaryFixedVariant: '#474747',
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
  full: 9999,
} as const;

export const spacing = {
  touchTargetMin: 64,
  stewardTargetMin: 44,
  gutter: 24,
  marginMobile: 20,
  stackSm: 8,
  stackMd: 16,
  stackLg: 32,
} as const;

export const typography = {
  displayElderly: {
    fontSize: 32,
    fontWeight: '800' as const,
    lineHeight: 40,
    letterSpacing: -0.02,
  },
  headlineLg: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  headlineSm: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  bodyLg: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  bodyLgElderly: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 30,
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  labelCaps: {
    fontSize: 12,
    fontWeight: '700' as const,
    lineHeight: 16,
    letterSpacing: 0.05,
  },
} as const;

export const animation = {
  breatheDuration: 4000,
  breatheScale: 1.05,
  pulseRingDuration: 2000,
  transitionDuration: 250,
} as const;
