import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  // Files/folders to ignore
  {
    ignores: ['dist/**', 'vendor/**', 'node_modules/**', 'coverage/**', '.wdio-*', 'project/**']
  },
  // Base JS recommended rules
  js.configs.recommended,
  // TypeScript files
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        CSSStyleSheet: 'readonly',
        setTimeout: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      // keep initial rule set minimal; we can tighten later per standards
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly'
      }
    }
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        process: 'readonly',
        console: 'readonly'
      }
    }
  }
];

