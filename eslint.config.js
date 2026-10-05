// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier/flat');

const tsFiles = ['**/*.ts', '**/*.tsx'];
const featureNames = ['auth', 'mode', 'gate', 'receptionist', 'customer'];

const textPath = {
  name: 'react-native',
  importNames: ['Text'],
  message: 'Use Text from @/shared/ui.',
};

const crossFeature = featureNames.map((f) => ({
  files: [`src/features/${f}/**`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [textPath],
        patterns: [
          {
            group: featureNames.filter((o) => o !== f).map((o) => `@/features/${o}/*`),
            message: 'A feature must not import another feature; go through src/shared.',
          },
        ],
      },
    ],
  },
}));

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*', 'eslint.config.js', 'android/*', 'ios/*'] },
  ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: tsFiles })),
  {
    files: tsFiles,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-imports': ['error', { paths: [textPath] }],
    },
  },
  ...crossFeature,
  {
    files: ['src/shared/ui/**', 'src/shared/theme/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/features/**/domain/**', 'src/shared/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [textPath],
          patterns: [
            {
              group: ['react', 'react-native', 'expo', 'expo-*', '@/shared/ui/*'],
              message: 'domain/ and shared/lib must stay pure (no React/RN/Expo).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', 'jest.setup.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
]);
