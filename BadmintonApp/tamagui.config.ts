import { defaultConfig } from '@tamagui/config/v4'
import { createTamagui } from 'tamagui'

export const config = createTamagui({
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    // Recommended for React Native compatibility
    styleCompat: 'react-native',
  },
})

export type CustomConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends CustomConfig {}
}

export default config
