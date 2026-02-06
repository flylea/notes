import { base } from 'eslint-config-ali';
import prettier from 'eslint-plugin-prettier/recommended';
import vueParser from 'vue-eslint-parser';

export default [
  ...base,
  prettier,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'lf',
        },
      ],
      'linebreak-style': ['error', 'unix'],
    },
  },
  {
    files: ['src/types/auto-imports.d.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
