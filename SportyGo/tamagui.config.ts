import { defaultConfig } from '@tamagui/config/v4'
import { createTamagui } from 'tamagui'

// Earthy Sport base palette
const earthyTokens = {
  earthyBg: '#FAF7F2',
  earthySurface: '#E5E7DB',
  earthyText: '#0F172A',
  earthyMuted: '#6B7280',
  earthyBorder: '#D1D5DB',

  earthyPrimary: '#065F46',
  earthyPrimaryHover: '#0B7A5C',
  earthyPrimaryPress: '#054C39',

  earthySecondary: '#B45309',
  earthySecondaryHover: '#C1650F',
  earthySecondaryPress: '#8F4107',

  earthyAccent: '#14B8A6',
  earthyAccentHover: '#10A392',
  earthyAccentPress: '#0E8074',

  earthySuccess: '#22C55E',
  earthyWarning: '#F59E0B',
  earthyDanger: '#EF4444',

  earthyCard: '#ECE9DF',
  earthyInput: '#F3F1EA',
  earthyShadow: 'rgba(15, 23, 42, 0.2)'
}

// Optional darker counterparts for a dark theme
const earthyDarkTokens = {
  earthyBg: '#121411',
  earthySurface: '#1B1E18',
  earthyText: '#E7E4DD',
  earthyMuted: '#9CA3AF',
  earthyBorder: '#2A2E26',

  earthyPrimary: '#14B8A6',
  earthyPrimaryHover: '#11A090',
  earthyPrimaryPress: '#0E8376',

  earthySecondary: '#D97706',
  earthySecondaryHover: '#C46A05',
  earthySecondaryPress: '#9A5304',

  earthyAccent: '#22C55E',
  earthyAccentHover: '#1FB155',
  earthyAccentPress: '#199247',

  earthySuccess: '#34D399',
  earthyWarning: '#F59E0B',
  earthyDanger: '#F87171',

  earthyCard: '#1E221B',
  earthyInput: '#232820',
  earthyShadow: 'rgba(0, 0, 0, 0.35)'
}

// Build color steps used by Tamagui themes ($color1..$color12)
const earthyLightSteps = {
  color1: '#FAF7F2', // background
  color2: '#E5E7DB', // surface
  color3: '#DCD8C9',
  color4: '#CBCAB6',
  color5: '#BBBCA6',
  color6: '#ABAE96',
  color7: '#9CA184',
  color8: '#8A9275',
  color9: '#065F46', // brand depth
  color10: '#6B7280', // muted text
  color11: '#0F172A', // text
  color12: '#000000', // highest contrast
  success: earthyTokens.earthySuccess,
  warning: earthyTokens.earthyWarning,
  danger: earthyTokens.earthyDanger,
}

const earthyDarkSteps = {
  color1: '#121411', // background
  color2: '#1B1E18', // surface
  color3: '#232820',
  color4: '#2A2E26',
  color5: '#33382E',
  color6: '#3D4337',
  color7: '#475041',
  color8: '#515A4A',
  color9: '#14B8A6', // brand depth
  color10: '#9CA3AF', // muted text
  color11: '#E7E4DD', // text
  color12: '#FFFFFF', // highest contrast
  success: earthyDarkTokens.earthySuccess,
  warning: earthyDarkTokens.earthyWarning,
  danger: earthyDarkTokens.earthyDanger,
}

export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      success: '#22C55E', // or earthyTokens.earthySuccess
      warning: '#F59E0B',
      danger: '#EF4444',
    },
  },
  themes: {
    ...defaultConfig.themes,
    'earthy-sport-light': {
      // Tamagui core theme keys
      color: earthyTokens.earthyText,
      background: earthyTokens.earthyBg,
      borderColor: earthyTokens.earthyBorder,
      shadowColor: earthyTokens.earthyShadow,
      placeholderColor: earthyTokens.earthyMuted,

      // State tokens often used by components like Button
      colorHover: earthyTokens.earthyText,
      colorPress: earthyTokens.earthyText,
      colorFocus: earthyTokens.earthyText,
      backgroundHover: earthyLightSteps.color2,
      backgroundPress: earthyLightSteps.color3,
      backgroundFocus: earthyLightSteps.color2,
      borderColorHover: earthyTokens.earthyBorder,
      borderColorPress: earthyTokens.earthyBorder,
      borderColorFocus: earthyTokens.earthyBorder,

      // Color steps for compatibility with $color1..$color12 usage
      ...earthyLightSteps,

      // Semantic roles
      primary: earthyTokens.earthyPrimary,
      primaryHover: earthyTokens.earthyPrimaryHover,
      primaryPress: earthyTokens.earthyPrimaryPress,

      secondary: earthyTokens.earthySecondary,
      secondaryHover: earthyTokens.earthySecondaryHover,
      secondaryPress: earthyTokens.earthySecondaryPress,

      accent: earthyTokens.earthyAccent,
      accentHover: earthyTokens.earthyAccentHover,
      accentPress: earthyTokens.earthyAccentPress,

      success: earthyTokens.earthySuccess,
      warning: earthyTokens.earthyWarning,
      danger: earthyTokens.earthyDanger,

      surface: earthyTokens.earthySurface,
      card: earthyTokens.earthyCard,
      input: earthyTokens.earthyInput,
    },
    'earthy-sport-dark': {
      color: earthyDarkSteps.color11,
      background: earthyDarkSteps.color1,
      borderColor: earthyDarkTokens.earthyBorder,
      shadowColor: earthyDarkTokens.earthyShadow,
      placeholderColor: earthyDarkTokens.earthyMuted,

      // State tokens often used by components like Button
      colorHover: earthyDarkSteps.color11,
      colorPress: earthyDarkSteps.color11,
      colorFocus: earthyDarkSteps.color11,
      backgroundHover: earthyDarkSteps.color2,
      backgroundPress: earthyDarkSteps.color3,
      backgroundFocus: earthyDarkSteps.color2,
      borderColorHover: earthyDarkTokens.earthyBorder,
      borderColorPress: earthyDarkTokens.earthyBorder,
      borderColorFocus: earthyDarkTokens.earthyBorder,

      ...earthyDarkSteps,

      primary: earthyDarkTokens.earthyPrimary,
      primaryHover: earthyDarkTokens.earthyPrimaryHover,
      primaryPress: earthyDarkTokens.earthyPrimaryPress,

      secondary: earthyDarkTokens.earthySecondary,
      secondaryHover: earthyDarkTokens.earthySecondaryHover,
      secondaryPress: earthyDarkTokens.earthySecondaryPress,

      accent: earthyDarkTokens.earthyAccent,
      accentHover: earthyDarkTokens.earthyAccentHover,
      accentPress: earthyDarkTokens.earthyAccentPress,

      success: earthyDarkTokens.earthySuccess,
      warning: earthyDarkTokens.earthyWarning,
      danger: earthyDarkTokens.earthyDanger,

      surface: earthyDarkTokens.earthySurface,
      card: earthyDarkTokens.earthyCard,
      input: earthyDarkTokens.earthyInput,
    },
  },
  settings: {
    ...defaultConfig.settings,
    // Recommended for React Native compatibility
    styleCompat: 'react-native',
  },
  // Do not force default theme; you can enable this if you want the app to use it by default
  // defaultTheme: 'earthy-sport-light',
})

export type CustomConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends CustomConfig {}
}

export default config
