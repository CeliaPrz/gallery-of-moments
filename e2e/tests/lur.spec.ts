import { test, expect, Page } from '@playwright/test';

// Comptes de démonstration : e-mails et mots de passe fournis par les secrets GitHub.
const ACCOUNTS = {
  admin: { email: process.env.LUR_ADMIN_EMAIL || 'admin@lur-demo.com', password: process.env.LUR_ADMIN_PASSWORD || '' },
  laurent: { email: process.env.LUR_LAURENT_EMAIL || 'laurent@lur-demo.com', password: process.env.LUR_LAURENT_PASSWORD || '' },
  marta: { email: process.env.LUR_MARTA_EMAIL || 'marta@lur-demo.com', password: process.env.LUR_MARTA_PASSWORD || '' },
};

// Identifiant de Castellana 120 (actif de Laurent) dans les données de démonstration.
const CASTELLANA_120_ID = '22222222-0000-0000-0000-000000000001';

async function login(page: Page, who: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[who];
  test.skip(!password, `Mot de passe de ${who} absent : ajoutez le secret correspondant.`);
  await page.goto('/auth');
  await page.getByLabel(/adresse e-mail|e-mail|email/i).fill(email);
  await page.getByLabel(/mot de passe/i).first().fill(password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/auth/);
}

test.describe('Page publique', () => {
  test('la page de connexion est propre et non indexée', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveTitle(/LUR/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
    // Aucune donnée de portefeuille avant connexion
    await expect(page.getByText(/M€/)).toHaveCount(0);
  });

  test('une page interne renvoie vers la connexion sans session', async ({ page }) => {
    await page.goto(`/actifs/${CASTELLANA_120_ID}`);
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText('Castellana 120')).toHaveCount(0);
  });

  test('le robots.txt interdit l\'indexation', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toMatch(/Disallow:\s*\//);
  });
});

test.describe('Investisseur FAEB (Laurent)', () => {
  test('voit son portefeuille et seulement le sien, en lecture seule', async ({ page }) => {
    await login(page, 'laurent');
    await expect(page.getByText(/92,6/).first()).toBeVisible();
    await expect(page.getByText('Castellana 120').first()).toBeVisible();
    await expect(page.getByText('Arturo Soria 45').first()).toBeVisible();
    await expect(page.getByText('Méndez Álvaro 9').first()).toBeVisible();
    await expect(page.getByText('Diagonal 512')).toHaveCount(0);
    await expect(page.getByText(/consultation seule/i).first()).toBeVisible();
    await expect(page.getByText('Administration')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /importer|modifier|supprimer/i })).toHaveCount(0);
  });

  test('ouvre la fiche de Castellana 120', async ({ page }) => {
    await login(page, 'laurent');
    await page.goto(`/actifs/${CASTELLANA_120_ID}`);
    await expect(page.getByText('Castellana 120').first()).toBeVisible();
    await expect(page.getByText(/Grupo Iberluz/).first()).toBeVisible();
  });
});

test.describe('Étanchéité entre investisseurs (Marta)', () => {
  test('ne voit jamais le portefeuille de Laurent', async ({ page }) => {
    await login(page, 'marta');
    await expect(page.getByText('Diagonal 512').first()).toBeVisible();
    await expect(page.getByText('Castellana 120')).toHaveCount(0);
    await expect(page.getByText(/92,6/)).toHaveCount(0);
  });

  test('ne peut pas ouvrir une fiche de Laurent par son adresse', async ({ page }) => {
    await login(page, 'marta');
    await page.goto(`/actifs/${CASTELLANA_120_ID}`);
    await expect(page.getByText(/n'est pas disponible|n’est pas disponible/i).first()).toBeVisible();
    await expect(page.getByText('Grupo Iberluz')).toHaveCount(0);
  });
});

test.describe('Administratrice', () => {
  test('voit la section Administration', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByText('Administration').first()).toBeVisible();
    await expect(page.getByText(/import/i).first()).toBeVisible();
  });
});

test.describe('Session', () => {
  test('la déconnexion renvoie vers la connexion et protège les pages', async ({ page }) => {
    await login(page, 'laurent');
    // Menu du profil, puis « Se déconnecter »
    const logout = page.getByRole('menuitem', { name: /se déconnecter/i }).or(page.getByRole('button', { name: /se déconnecter/i }));
    if (!(await logout.first().isVisible())) {
      await page.getByRole('button', { name: /profil|compte|laurent|menu/i }).first().click();
    }
    await logout.first().click();
    await expect(page).toHaveURL(/\/auth/);
    await page.goto(`/actifs/${CASTELLANA_120_ID}`);
    await expect(page).toHaveURL(/\/auth/);
  });
});
