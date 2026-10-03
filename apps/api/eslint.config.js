// ESLint flat config for apps/api. The two type-aware rules (no-floating-promises, no-misused-promises)
// are the ones that matter for security and async correctness: a forgotten await is a silent bug.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.js', 'uploads/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Express type augmentation (declare global { namespace Express ... }) needs a namespace declaration
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      // Style rules: reported, not blocking. `_name` marks an intentionally unused argument.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
    },
  }
);
