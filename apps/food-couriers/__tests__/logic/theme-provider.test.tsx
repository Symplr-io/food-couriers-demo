import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useThemeMode } from '../../src/gen/theme/ThemeProvider';

let theme!: ReturnType<typeof useThemeMode>;
function Probe() {
  theme = useThemeMode();
  return null;
}

async function mount() {
  await act(async () => {
    renderer.create(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
  });
}

beforeEach(() => AsyncStorage.clear());

test('restores the saved mode', async () => {
  await AsyncStorage.setItem('theme.mode', 'dark');
  await mount();
  expect(theme.mode).toBe('dark');
  expect(theme.scheme).toBe('dark');
});

test('setMode switches the scheme and saves the mode', async () => {
  await mount();
  expect(theme.mode).toBe('system');
  await act(async () => theme.setMode('dark'));
  expect(theme.scheme).toBe('dark');
  expect(await AsyncStorage.getItem('theme.mode')).toBe('dark');
});
