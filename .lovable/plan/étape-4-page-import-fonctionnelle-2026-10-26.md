# Étape 4 — Page Import fonctionnelle

Mise en page et style de la maquette conservés. Aucune migration : écriture dans les tables existantes avec la session de l'administratrice. Les autres pages ne sont pas touchées.

## Parcours

1. **Dépôt** : sélecteur d'investisseur, un ou plusieurs .xlsx (5 Mo max chacun), traités l'un après l'autre, chacun avec son aperçu et sa validation.
2. **Lecture dans le navigateur** avec exceljs : 7 onglets du modèle v1.2 (« Mode d'emploi » ignoré), en-têtes comparés sans « * » ni espaces, données dès la ligne 2, lignes vides ignorées.
3. **Contrôles** : les 8 contrôles bloquants (badge rouge, bouton désactivé) et les 7 avertissements (badge ambre), exactement comme dans votre texte. Chaque message cite onglet, ligne, colonne, problème et correction attendue.
4. **Aperçu** : badges (onglets lus, avertissements, erreurs), liste des erreurs puis des avertissements, aperçu par onglet au format français, valeurs telles que lues.
5. **Valider l'import**, dans l'ordre : dépôt du fichier dans « imports » ({code investisseur}/{date-heure}_{nom}) → ligne imports « en_attente » → actifs (création ; existant : seuls les champs vides complétés) → lots (création/mise à jour, aucune suppression) → locataires (rapprochement par nom normalisé) → asset_kpis, leases, loans, bp_versions avec le nouvel import_id → statut « valide » et remplacement des imports précédents entièrement couverts.
6. **Échec** : suppression de la ligne en attente, message rouge brique, rien de validé. **Succès** : « Import validé : {n} actifs mis à jour au {Date des données}. » + lien vers le tableau de bord de l'investisseur.
7. **Annuler** : abandon du fichier, rien n'est écrit.
8. **Derniers imports** : 5 derniers de l'investisseur choisi, statuts Validé (vert), Remplacé (gris), En attente (ambre).

## Points à vérifier avant ou pendant la construction

- **Nettoyage en cas d'échec** : supprimer la ligne imports n'efface ses données liées que si la base est réglée en suppression en cascade. Je vérifierai ce réglage en lecture ; s'il n'existe pas, je supprimerai explicitement les lignes liées (kpis, baux, prêts, BP) avant la ligne imports. Les actifs, lots et locataires créés ou complétés ne portent pas d'import_id et resteront en place — je vous le signalerai, sans modifier la base.
- **Fichier déposé en cas d'échec** : il sera également retiré du stockage.
- **« Code actif déjà attribué à un autre investisseur »** : l'administratrice voit tous les actifs (RLS admin), le contrôle est donc fiable.
- Je ne pourrai pas tester un vrai import connecté (Supabase externe, aucune session) : je vérifierai avec des tests automatiques sur des fichiers fictifs générés en mémoire.

## Détails techniques

- Ajout du paquet `exceljs`, chargé à la demande dans le navigateur uniquement.
- Règles pures (lecture des en-têtes, conversion dates/nombres, contrôles, avertissements, ordre de remplacement) dans `src/lib/import-template.ts` et `src/lib/import-checks.ts`, testées avec vitest (un test par contrôle).
- Écritures dans une fonction serveur authentifiée `src/lib/imports.functions.ts` (vérification du rôle admin, puis étapes 2 à 8) ; le dépôt du fichier se fait avec le client de la session. L'actuelle `recordImport` est remplacée.
- `src/routes/_authenticated/import.tsx` rebranché sur ces modules sans changer la mise en page.
