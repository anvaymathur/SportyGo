// babel.config.js
module.exports = function (api) {
  api.cache(true)
  // Jest renders Tamagui at runtime; the compiler plugin only slows tests down
  const isTest = process.env.NODE_ENV === 'test'
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      !isTest && [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logTimings: true,
          disableExtraction: process.env.NODE_ENV === 'development',
        },
      ],
      'react-native-reanimated/plugin', // if you use Reanimated
    ].filter(Boolean),
  }
}
