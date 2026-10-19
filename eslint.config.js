import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { parser: tseslint.parser },
  rules: {
    // Tauri plugins replace these globals at runtime (tauri-plugin-dialog makes
    // `confirm` return a Promise), so tsc cannot catch a missing or changed plugin.
    // Call the plugin through src/services/tauri.ts instead.
    'no-alert': 'error',
  },
});
