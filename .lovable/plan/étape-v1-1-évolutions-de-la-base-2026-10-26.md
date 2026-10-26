# Étape V1.1 — évolutions de la base

Aucune migration, aucune modification de table, vue, fonction ou RLS. Style actuel conservé, aucun texte inventé hors ceux de la demande.

## 0. Types Supabase
Régénérer les types du projet (ils ne connaissent pas encore tenant_contacts, assets.status/exit_date/exit_reason, leases.actual_end_date, tenants.anonymized_at, profiles.is_active/deactivated_at).

## 1. Actifs sortis
- Fiche actif (admin) : bouton secondaire « Marquer comme sorti » → fenêtre : date (obligatoire), motif (Vente / Fin de mandat), texte de confirmation fourni. Enregistre status, exit_date, exit_reason.
- Actif sorti (admin) : badge gris « Sorti le JJ/MM/AAAA · Motif » + bouton « Remettre en portefeuille » avec confirmation (vide date et motif).
- Tableau de bord (admin) : actifs sortis retirés de la liste, des alertes et du graphique des loyers ; section repliée « Actifs sortis (n) » en bas (nom, date, motif, lien vers la fiche). Les totaux restent ceux de portfolio_summary.
- Barre latérale (admin) : actifs sortis regroupés à la fin, texte atténué.

## 2. Contacts des locataires
Onglet Baux et locataires, admin uniquement : bloc « Contacts des locataires » sous le tableau, par locataire, avec Ajouter / Modifier / Supprimer (nom, fonction, e-mail, téléphone). Jamais chargé ni affiché pour l'investisseur.

## 3. Anonymisation
Bouton discret « Anonymiser » par locataire dans ce bloc, confirmation fournie. Nom → « Locataire anonymisé », NIF vidé, contacts supprimés, anonymized_at = maintenant. Affiché en italique partout (baux, lots, alertes).

## 4. Fin réelle d'un bail
Colonne « Fin réelle » (— si vide). Admin : petite icône crayon sur la ligne → saisie d'une date uniquement.

## 5. Compte désactivé
À la connexion et à chaque chargement de l'espace connecté : si is_active = false, déconnexion et message « Votre compte a été désactivé. Contactez l'équipe de gestion. » sur l'écran de connexion.

## Détails techniques
- Écritures via nouvelles fonctions serveur `requireSupabaseAuth` (client de l'utilisateur, la RLS admin_all fait foi) dans `src/lib/admin-edits.functions.ts` : setAssetExit, restoreAsset, upsert/deleteTenantContact, anonymizeTenant, setLeaseActualEnd. Chaque fonction ne met à jour que les colonnes descriptives citées.
- Lectures : getAssetSheet ajoute status/exit, actual_end_date, anonymized_at, et contacts seulement si admin ; getDashboard/getSidebarAssets filtrent status côté admin (filtre d'affichage, pas de sécurité).
- Contrôle is_active dans le gate connecté et après signIn sur /auth (message passé en paramètre).
- Tests vitest : exclusion des actifs sortis des alertes, libellé anonymisé.

## Points à vérifier
- Si l'administratrice n'a pas le droit de mettre à jour ces colonnes via la RLS existante, je m'arrêterai et l'expliquerai.
- Tests connectés impossibles (Supabase externe sans session).
