En attente de l'écran 4/4. Écrans 1, 2 et 3 reçus et analysés.

Règles confirmées pour la construction :

1. Images : aucun lien d'image externe du HTML. Remplacement par des icônes ou des zones neutres. Les photos d'immeubles viendront plus tard du stockage Supabase.
2. Fidélité : mise en page, couleurs, polices et textes repris à l'identique, sans ajout.
3. Chiffres : les valeurs du HTML ne sont que des exemples. Rien d'écrit en dur dans la logique ; les données sont prévues pour venir des vues portfolio_summary et asset_summary et des tables leases, units, loans, bp_versions, imports.
4. Base de données : aucune création, modification ou suppression de table, vue ou règle de sécurité, et aucune migration proposée.
5. Pages, avec une barre latérale commune (sauf Connexion) :
   - Connexion
   - Tableau de bord
   - Fiche actif (/actifs/:id)
   - Import (réservée à l'administratrice)

## Écran 1/4 — Connexion
Page seule, sans barre latérale. Identiques au HTML reçu.

## Écran 2/4 — Tableau de bord
Barre latérale : LUR / Gestion d'actifs ; items Tableau de bord (actif), Actifs, Rapports, Documents ; carte utilisateur (nom, fonds, mention « Consultation Seule » avec icône visibility).
En-tête : champ de recherche « Rechercher un immeuble, bail, locataire... », avatar.
Contenu :
- Titre « Bonjour Laurent » + pastille « Données à jour au … » (point pulsant).
- Rangée de cartes d'indicateurs : Valeur du portefeuille, Loyers annuels, Taux d'occupation, LTV du portefeuille. Le HTML prévoit 5 emplacements mais le 4e est vide : à confirmer avec l'utilisatrice.
- Ligne d'audit sous la rangée : Source : … · version · importé le …
- Deux colonnes : à gauche « Alertes » (compteur d'éléments, une ligne par alerte avec icône, actif, type Covenant/Échéance/Vacance et description) ; à droite « Loyers annuels par actif » (total, une barre proportionnelle par actif, valeur en M€).
- Tableau « Mes actifs » (nombre d'immeubles en en-tête) : Actif, Ville, Surface, Valeur, Occupation, LTV, Prochaine échéance, Dernière mise à jour, flèche d'accès. Occupation en vert ; LTV au-delà du seuil en ambre.
- Carte « Dernier rapport » : libellé du rapport validé + bouton « Télécharger le PDF ».
Sources : vue portfolio_summary (cartes, totaux), asset_summary et tables units/leases/loans (lignes du tableau, barres de loyers), table imports (ligne d'audit), table leases (prochaine échéance), bp_versions/imports (dernière mise à jour). Alertes : à déduire de leases (échéances), units (vacance) et loans (covenant LTV), sans valeur seuil en dur.

## Écran 3/4 — Fiche actif (/actifs/:id)
Même barre latérale et en-tête.
- Fil d'Ariane : Tableau de bord > nom de l'actif ; pastille « Lecture seule institutionnelle · FAEB » avec cadenas.
- En-tête d'actif : icône, nom, badge d'alerte pulsant, ligne « type · adresse · surface », micro-tags Acquisition et Stratégie.
- Onglets : Synthèse (actif), Baux et locataires, Financement, Business plan, Documents.
- 4 indicateurs : Valeur vénale (date d'expertise), Loyers annuels, Taux d'occupation (mini jauge circulaire, m² vacants, taux financier), LTV (badge « Proche covenant », seuil max, barre de progression).
- Tableau « Baux et locataires » (nb de locataires actifs · nb de lots vacants) : Lot, Locataire, Surface, Loyer annuel, Échéance, Option de sortie, Indexation. Ligne vacante en ambre avec mention « vacant depuis … ».
- Deux colonnes : Financement (prêteur et rang, encours de dette, échéance et maturité résiduelle, ICR avec covenant, jauge de covenant LTV) et Business plan (badge d'approbation, version de référence active et sa description, rendement initial, TRI cible, lien « Voir les versions précédentes (n) »).
- Ligne d'audit sous chaque bloc.
Sources : vue asset_summary (en-tête, indicateurs), table leases + units (tableau des baux, lots vacants), table loans (financement, ICR, covenant), table bp_versions (version active, rendement, TRI, nombre de versions), table imports (lignes d'audit). Aucun seuil, taux ni pourcentage en dur.

## Écran 4/4 — Import
Non reçu.

Prochaine étape : recevoir l'écran 4/4, puis compléter le plan écran par écran et confirmer la 4e carte du tableau de bord. Le contrôle d'accès à la page Import se fera à partir des rôles déjà existants dans Supabase, après vérification en lecture seule.
