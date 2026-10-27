import { defineConfig, devices } from '@playwright/test';
 
// Tests exécutés sur le site en ligne (aucune donnée réelle : comptes de démonstration).
// L'adresse et les mots de passe viennent des variables d'environnement, jamais du code.
export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: 1,
  workers: 1, // les tests partagent les mêmes comptes : on les lance l'un après l'autre
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://gallery-of-moments.vercel.app',
    locale: 'fr-FR',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
