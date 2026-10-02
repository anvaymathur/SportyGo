import React from 'react';
import { render } from '@testing-library/react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';

// Render a screen inside the same Tamagui provider/theme the app uses
export function renderWithTheme(ui: React.ReactElement) {
  return render(
    <TamaguiProvider config={config} defaultTheme="light">
      <Theme name="earthy-sport-light">{ui}</Theme>
    </TamaguiProvider>
  );
}
