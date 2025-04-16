import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginTs from '@typescript-eslint/eslint-plugin';
import parserTs from '@typescript-eslint/parser';
import pluginReact from 'eslint-plugin-react';
import pluginNext from '@next/eslint-plugin-next';

export default [
  {
    // Apply to JavaScript, TypeScript, and JSX files
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: parserTs, // Use TypeScript parser
      sourceType: 'module',
      globals: {
        ...globals.browser, // Browser globals (window, document, etc.)
        ...globals.node,    // Node.js globals (process, require, etc.)
      },
    },
    plugins: {
      '@typescript-eslint': pluginTs,
      react: pluginReact,
      '@next/next': pluginNext,
    },
    rules: {
      // Base JavaScript rules
      ...pluginJs.configs.recommended.rules,
      // TypeScript rules
      ...pluginTs.configs.recommended.rules,
      // React rules
      ...pluginReact.configs.recommended.rules,
      // Next.js rules
      ...pluginNext.configs.recommended.rules,
      // Custom adjustments
      'react/react-in-jsx-scope': 'off', // Not needed with Next.js
      '@next/next/no-html-link-for-pages': 'off', // Optional: disable if using <a> tags
    },
    settings: {
      react: {
        version: 'detect', // Automatically detect React version
      },
    },
  },
];