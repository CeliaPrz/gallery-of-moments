# Application LUR — Gestion d'actifs

## Ce qui sera construit

Quatre pages, chacune reprise à l'identique de l'écran HTML correspondant :

- **Connexion** — page seule, sans barre latérale.
- **Tableau de bord** — « Bonjour Laurent », indicateurs, alertes, loyers par actif, tableau des actifs, dernier rapport.
- **Fiche actif** (`/actifs/:id`) — en-tête d'actif, onglets, 4 indicateurs, baux et locataires, financement, business plan.
- **Import** — réservé à l'administratrice : sélection du fichier, contrôles, historique des imports, modèle standard.

Une **barre latérale commune** à ces pages (sauf Connexion), en deux versions selon le rôle :

- version **consultation** (écrans 2 et 3) : Tableau de bord, Actifs, Rapports, Documents ; carte utilisateur avec la mention « Consultation Seule » ; icônes `grid_view`, `apartment`, `analytics`, `folder_open`.
- version **administration** (écran 4) : sections « Portefeuille » et « Administration » (Investisseurs, Import, Historique des imports, Rapports admin) ; badge « Administration » ; icônes `dashboard`, `domain`, `bar_chart`, `folder_open`.

## Règles de fidélité

1. Aucun lien d'image externe du HTML. Les visuels sont des icônes Material Symbols ou des zones neutres. Les photos d'immeubles viendront plus tard du stockage Supabase (champ `photo_path` déjà prévu).
2. Mise en page, couleurs, polices (Manrope pour les titres et indicateurs, Inter pour le texte), espacements, libellés et textes repris tels quels, sans ajout.
3. Les chiffres du HTML sont des exemples : aucun n'est écrit en dur dans la logique. Tout est lu dans les vues et tables déjà présentes.
4. **Aucune création, modification ou suppression de table, de vue ou de règle de sécurité. Aucune migration proposée.** L'application lit le schéma tel qu'il existe.
5. Actifs, Rapports, Documents, Investisseurs, Historique des imports et Rapports admin restent des liens qui ne mènent nulle part, comme dans le HTML.
6. Les onglets de la fiche actif affichent et masquent des sections de la même page.
7. Le tableau de bord garde les 4 cartes effectivement présentes dans le HTML.

## Où chaque chiffre est-il pris

**Tableau de bord** — vue `portfolio_summary` : Valeur du portefeuille = `total_value`, Loyers annuels = `total_annual_rent`, Taux d'occupation = `occupancy_rate`, LTV = `portfolio_ltv`, « Données à jour au … » = `latest_data_date`.
Tableau « Mes actifs » — vue `asset_summary`, ligne par ligne : nom, ville, `lettable_area_sqm`, `market_value`, `occupancy_rate`, `ltv`, et le nombre d'immeubles = `assets_count`. Prochaine échéance = `end_date` le plus proche parmi les baux actifs de l'actif (`leases`). Dernière mise à jour = date de l'import courant (`imports.imported_at`, `as_of_date`).
Alertes — déduites, sans seuil écrit en dur : covenant de `loans.ltv` par rapport à `loans.ltv_covenant`, échéance proche dans `leases.end_date`, vacance dans `units.vacant_since` et `asset_summary.vacant_area_sqm`.
Loyers annuels par actif — `asset_summary.annual_rent`, barre proportionnelle à la plus grande valeur, total = `total_annual_rent`.
Dernier rapport — table `reports` : `period_label`, `validated_at`, fichier `pdf_path`.

**Fiche actif** — vue `asset_summary` pour l'en-tête et les indicateurs : `market_value` et `valuation_date`, `annual_rent`, `occupancy_rate` et `vacant_area_sqm`, `ltv`. Table « Baux et locataires » — `leases` rapprochée de `units` (`label`, `floor`, `vacant_since`) et de `tenants` (`name`) : `area_sqm`, `annual_rent`, `end_date`, `break_date`, `indexation`. Lots vacants = `units` sans bail actif.
Financement — table `loans` : `lender`, `amortization_type`, `outstanding`, `maturity_date`, `icr`, `icr_covenant`, `ltv`, `ltv_covenant`.
Business plan — table `bp_versions` : version `is_current` (`version_label`, `version_date`, `comment`, `initial_yield`, `target_irr`) et nombre de versions précédentes.
Fil d'Ariane, type, adresse, surface, acquisition et stratégie — table `assets` (`asset_type`, `address`, `city`, `lettable_area_sqm`, `acquisition_date`, `strategy`).
Lignes « Source : … » — table `imports` : `file_name`, `template_version`, `imported_at`.

**Import** — table `imports` pour l'historique (`imported_at`, `file_name`, `template_version`, `status`, `imported_by`, `notes`, `replaced_by`) et `investors` pour le sélecteur. Les aperçus sous onglets lisent `asset_summary`.

## Accès

Le rôle vient de `profiles.role` (`admin` ou `investor`) et de la fonction `is_admin()` déjà en base. La page Import n'est atteignable que par l'administratrice ; la section « Administration » de la barre latérale n'apparaît que pour elle. Les données affichées sont celles de l'investisseur de l'utilisateur (`my_investor_id()`), donc Laurent ne voit que son fonds.

## Détails techniques

- TanStack Start : routes `index.tsx` (Connexion), `_authenticated/` (barre latérale + en-tête dans un layout, puis `tableau-de-bord`, `actifs/$id`, `import`), `head()` propre à chaque page.
- Polices Manrope et Inter et l'icônes Material Symbols chargées par `<link>` dans `src/routes/__root.tsx`.
- Palette et échelles du HTML recréées comme jetons Tailwind v4 dans `src/styles.css` (`@theme`), sans `tailwind.config.js`.
- Lectures via fonctions serveur avec la session de l'utilisateur, donc les règles de sécurité existantes s'appliquent telles quelles.
- Formatage des nombres en français (virgule décimale, espace insécable, `M€`, `%`).

## Ce qui reste en attente de votre côté

- **Le fichier modèle Excel v1.2** n'a pas été fourni. Sans lui, le bouton « Télécharger le modèle Excel v1.2 » et la lecture réelle des onglets (.xlsx) ne peuvent pas être branchés sur un vrai fichier. La page Import sera construite à l'identique, avec la sélection et le dépôt de fichier réels, et l'enregistrement de l'import dans la table `imports` ; le traitement complet des onglets sera ajouté dès que le modèle sera disponible.
- Le contrôle de la page Import et des données affichées suppose que des comptes existent déjà dans Supabase ; je les utilise en lecture seule, je n'en crée pas.
