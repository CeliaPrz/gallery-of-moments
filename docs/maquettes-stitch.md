# Maquettes Stitch — LUR

Les quatre écrans du MVP ont été conçus dans Stitch (mode Web), puis intégrés dans Lovable en collant le HTML exporté de chaque écran. Les liens de partage Stitch exigeant une connexion Google, ce document conserve à leur place la démarche, le système de design, les prompts et les écarts entre maquettes et application.

## Démarche

1. Prompt 0 : système de design commun (couleurs, typographie, composants), validé avant tout écran.
2. Prompts 1 à 4 : un écran par prompt, dans le même projet Stitch, avec des données fictives identiques d'un écran à l'autre.
3. Corrections : Stitch inventait des chiffres, des lieux et des noms d'entreprise. Chaque prompt a reçu la consigne « n'ajoute aucun chiffre, nom ou texte qui ne figure pas dans le prompt », et les écrans ont été corrigés un par un.
4. Intégration : le HTML de chaque écran a été collé dans Lovable (mode Plan), après un message de règles : base de données intouchable, aucun contenu inventé.
5. Cadrage durable : les règles de style ont été reportées dans le knowledge du projet Lovable, pour que chaque nouveau prompt les respecte.

## Système de design

| Élément | Choix | Raison |
|---|---|---|
| Fond de page | Beige #F3EEE6 | Chaleureux, moins austère qu'un blanc pur |
| Cartes | Blanc cassé #FFFDF9, coins 16 px, ombres douces | Lecture par blocs, un indicateur par carte |
| Couleur principale | Vert forêt #2E4738 | Barre latérale, boutons, navigation active ; alignée sur l'identité de l'activité |
| Couleur secondaire | Vert sauge #DCE5DA | Pastilles d'icônes, badges, survols |
| Texte | #1E2B24 ; secondaire #6B645A | Le gris initial #7A7368 a été foncé après l'audit de contraste (5,3:1, niveau AA) |
| États | Ambre #B7791F (alerte), rouge brique #A23B2A (erreur) | Codes compris sans légende, toujours accompagnés d'un texte |
| Typographie | Manrope (titres, grands chiffres), Inter (texte), chiffres tabulaires | Lisibilité des montants alignés en colonnes |

## Les quatre écrans

| Écran | Pour qui | Ce qu'il montre | Capture |
|---|---|---|---|
| Connexion | Tous | Panneau vert avec le logo, formulaire ; aucune donnée ni description du portail avant connexion | `stitch-connexion.png` |
| Tableau de bord | Investisseur | Indicateurs, alertes, loyers par actif, liste des actifs, source de chaque chiffre | `stitch-tableau-de-bord.png` |
| Fiche actif | Investisseur | Synthèse, baux et locataires, financement avec covenant, business plan | `stitch-fiche-actif.png` |
| Import | Administratrice | Dépôt du fichier, aperçu par onglet, erreurs et avertissements, validation | `stitch-import.png` |

### Connexion
![Écran de connexion](stitch-connexion.png)

### Tableau de bord
![Tableau de bord investisseur](stitch-tableau-de-bord.png)

### Fiche actif
![Fiche actif](stitch-fiche-actif.png)

### Import
![Import Excel, vue administratrice](stitch-import.png)

## Écarts entre les maquettes et l'application livrée

| Écart | Raison |
|---|---|
| 4 cartes d'indicateurs au lieu de 5 (pas de WALT / WALB, pas d'encours au niveau du portefeuille) | Recentrer le tableau de bord sur les quatre chiffres de l'objectif SMART |
| Champ de recherche supprimé | Inutile avec 3 ou 4 actifs ; menu déroulant des actifs dans la barre latérale à la place |
| Icônes Material Symbols remplacées (lucide-react) | La police d'icônes pesait 4 Mo (audit Lighthouse) |
| Texte secondaire plus foncé | Contraste WCAG AA |
| Chiffres réels de la base au lieu des chiffres écrits dans la maquette | Les maquettes montraient des valeurs figées ; l'application lit les vues de Supabase |

## Prompts utilisés

### Prompt 0 — Style commun

```
Crée le système de design de « LUR », une application web de gestion de patrimoine immobilier tertiaire, utilisée par des investisseurs institutionnels (fonds, sociétés de gestion) pour suivre leurs immeubles tertiaires en Espagne. Ne mentionne aucune ville ni aucun lieu dans les textes de présentation. Interface en français, sur ordinateur (1440 px de large).

Ambiance : tableau de bord moderne et chaleureux, aéré, avec des cartes blanches très arrondies posées sur un fond beige, des icônes dans des pastilles rondes de couleur douce et des graphiques simples (barres, anneau). Haut de gamme et rassurant, comme un outil financier, mais pas austère. Pas de dégradés criards, pas d'illustrations enfantines, pas d'emojis.

Couleurs :
- Fond de page beige clair (#F3EEE6), cartes blanc cassé (#FFFDF9).
- Couleur principale vert forêt profond (#2E4738) : barre latérale, boutons principaux, navigation active, titres forts.
- Vert sauge clair (#DCE5DA) pour les pastilles d'icônes, les fonds de badges et les éléments survolés.
- Texte principal vert très foncé presque noir (#1E2B24), texte secondaire gris taupe (#7A7368).
- Accent doré discret (#B98A3E) pour un indicateur mis en avant.
- Couleurs d'état : ambre (#B7791F) pour les alertes, rouge brique (#A23B2A) pour les erreurs, vert (#3F7A5A) pour « À jour ».

Typographie : Manrope pour les titres et les grands chiffres, Inter pour le texte, chiffres tabulaires alignés dans les tableaux.

Composants :
- Barre latérale gauche vert forêt (#2E4738) avec le logo texte « LUR » en blanc, en capitales espacées, la navigation (Tableau de bord, Actifs, Rapports, Documents) avec icônes au trait blanc, et en bas l'avatar et le nom de l'utilisateur.
- Barre supérieure avec titre de la page, champ de recherche arrondi et icône de notifications.
- Cartes d'indicateurs avec une pastille d'icône vert sauge, un libellé, une grande valeur chiffrée et une petite ligne de contexte.
- Tableaux de données dans des cartes, en-têtes discrets, lignes fines, badges d'état arrondis (Vacant, Alerte, À jour).
- Sous chaque bloc chiffré, une petite mention grise : « Source : nom du fichier · v1.2 · importé le 14/10/2026 ».
- Coins très arrondis (16 px pour les cartes, 12 px pour les boutons), ombres très douces, beaucoup d'espace entre les cartes.
```

### Prompt 1 — Connexion (F1)

```
Génère l'écran de connexion de l'application « LUR », avec le même système de design.
- Écran partagé en deux : à gauche (40 %), un panneau vert forêt (#2E4738) avec le logo texte « LUR » en blanc, en capitales espacées, un petit badge « Gestion d'actifs tertiaires » (sans aucun lieu), la phrase « Votre portefeuille immobilier, à jour et traçable. » et, en bas, la mention discrète « Accès réservé aux investisseurs et à l'équipe de gestion ».
- À droite, sur fond beige (#F3EEE6), une carte blanche arrondie avec un formulaire centré (largeur 400 px) : titre « Connexion », champ « Adresse e-mail », champ « Mot de passe » avec icône pour afficher le mot de passe, lien « Mot de passe oublié ? », bouton principal pleine largeur « Se connecter ».
- Sous le bouton, une ligne avec une icône de cadenas : « Vous accédez uniquement aux actifs de votre portefeuille. »
- Pas de bouton d'inscription : les comptes sont créés par l'équipe de gestion.
- Ne décris pas le portail : aucun paragraphe de présentation, aucune liste de fonctionnalités, aucun argument commercial. Le panneau de gauche ne contient que le logo, le badge, la phrase d'accroche et la mention d'accès réservé.
- Important : aucun chiffre ni donnée de portefeuille sur cet écran (pas de montant, pas de taux d'occupation), car l'utilisateur n'est pas encore connecté. N'invente aucun nom d'entreprise, aucun slogan supplémentaire, aucune mention technique (version, chiffrement, statut système). N'utilise que les textes indiqués ici.
```

Sur tous les écrans suivants, n'ajoute aucun chiffre, nom ou texte qui ne figure pas dans le prompt.

### Prompt 2 — Tableau de bord investisseur (F2)

```
Génère l'écran « Tableau de bord » vu par un investisseur, avec le même système de design. Barre latérale avec « Tableau de bord » actif, utilisateur en bas : « Laurent Mercier · Fonds Atlantique Europe Bureaux ». L'investisseur est en lecture seule : aucun bouton de modification.

- En-tête : « Bonjour Laurent » et, à droite, un badge « Données à jour au 14/10/2026 ».
- Rangée de 4 cartes d'indicateurs : Valeur du portefeuille 92,6 M€ · Loyers annuels 4,71 M€ · Taux d'occupation 93 % · LTV du portefeuille 48 %. Sous la rangée, mention de source : « Source : Portefeuille_FAEB_T3-2026_v3.xlsx · v1.2 · importé le 14/10/2026 ».
- Bloc « Alertes » avec trois lignes, chacune avec une icône et un badge orange ambré :
  1. « Arturo Soria 45 : LTV à 52 %, covenant à 55 % »
  2. « Castellana 120 : bail Grupo Iberluz à échéance le 30/06/2027 »
  3. « Arturo Soria 45 : 940 m² vacants au 3e étage depuis 7 mois »
- Tableau « Mes actifs » avec les colonnes : Actif, Ville, Surface, Valeur, Occupation, LTV, Prochaine échéance, Dernière mise à jour. Trois lignes :
  - Castellana 120 · Madrid · 8 400 m² · 42,5 M€ · 94 % · 48 % · 30/06/2027 · 14/10/2026
  - Arturo Soria 45 · Madrid · 5 200 m² · 21,8 M€ · 82 % · 52 % (badge orange) · 31/12/2028 · 14/10/2026
  - Méndez Álvaro 9 · Madrid · 6 900 m² · 28,3 M€ · 100 % · 45 % · 31/03/2030 · 14/10/2026
  Chaque ligne est cliquable vers la fiche de l'actif (petite flèche à droite).
- À côté des alertes, une carte « Loyers annuels par actif » avec un graphique en barres horizontales simple : Castellana 120 · 2,14 M€ ; Arturo Soria 45 · 1,09 M€ ; Méndez Álvaro 9 · 1,48 M€. Barres vert forêt, valeur affichée au bout de chaque barre, avec la même mention de source en dessous.
- Carte « Dernier rapport » : « Rapport du 3e trimestre 2026 · validé le 16/10/2026 » avec un bouton secondaire « Télécharger le PDF ».

N'ajoute aucun chiffre, nom, graphique ou texte qui ne figure pas dans ce prompt. Pas de bouton « Ajouter », « Modifier » ou « Importer » : l'investisseur ne fait que consulter.
```

### Prompt 3 — Fiche actif (F3)

```
Génère l'écran « Fiche actif » de l'immeuble Arturo Soria 45, vu par l'investisseur, avec le même système de design. Lecture seule, aucun bouton de modification.

- Fil d'Ariane : « Tableau de bord › Arturo Soria 45 ».
- En-tête : nom « Arturo Soria 45 », sous-titre « Bureaux · Calle de Arturo Soria 45, Madrid · 5 200 m² », badge orange « 1 alerte ».
- Onglets : Synthèse (actif) · Baux et locataires · Financement · Business plan · Documents.
- Onglet Synthèse affiché :
  - Rangée de 4 indicateurs : Valeur 21,8 M€ · Loyers annuels 1,09 M€ · Occupation 82 % · LTV 52 %.
  - Tableau « Baux et locataires » : colonnes Lot, Locataire, Surface, Loyer annuel, Échéance, Option de sortie, Indexation.
    - RDC-1er · Nexa Consulting · 1 900 m² · 420 000 € · 31/12/2028 · 31/12/2026 · IPC
    - 2e étage · Clínica Serrano · 1 180 m² · 290 000 € · 30/09/2029 · — · IPC
    - 3e étage · Vacant (badge « Vacant depuis 7 mois ») · 940 m² · — · — · — · —
    - 4e-5e étages · Ruta Logística · 1 180 m² · 380 000 € · 31/05/2031 · 31/05/2028 · IPC plafonné 3 %
  - Carte « Financement » : Prêteur Banco Meridional · Encours 11,3 M€ · Échéance 15/03/2029 · LTV 52 % avec une barre de progression vers le seuil de covenant à 55 % (zone orange) · ICR 2,1x (covenant 1,6x).
  - Carte « Business plan » : « Version en vigueur : BP v4 du 30/09/2026 » avec rendement initial 5,0 % et lien « Voir les versions précédentes (3) ».
- Sous chaque bloc chiffré, la mention grise : « Source : Portefeuille_FAEB_T3-2026_v3.xlsx · v1.2 · importé le 14/10/2026 ».
```

### Prompt 4 — Import Excel, vue administratrice (F4)

```
Génère l'écran « Import des données » vu par l'administratrice, avec le même système de design. Barre latérale avec une section supplémentaire « Administration » (Investisseurs, Import, Historique des imports, Rapports), « Import » actif. Utilisateur en bas : « Administratrice ».

- Titre « Importer un fichier Excel » et sous-titre « Les chiffres financiers ne changent que par import. Aucun calcul n'est fait dans l'application. »
- Étape 1 : sélecteur « Investisseur » (Fonds Atlantique Europe Bureaux) et grande zone de dépôt en pointillés « Déposez un ou plusieurs fichiers .xlsx au format du modèle standard ». Un fichier déjà déposé : « Portefeuille_FAEB_T3-2026_v3.xlsx · modèle v1.2 · 248 Ko ».
- Étape 2 « Aperçu et contrôles » :
  - Résumé en trois badges : « 6 onglets lus » (vert), « 1 avertissement » (orange), « 1 erreur bloquante » (rouge).
  - Liste des contrôles :
    - Erreur (rouge) : « Onglet Baux, ligne 14 : la date d'échéance « 31/02/2029 » n'est pas valide. Corrigez la date dans le fichier puis déposez-le à nouveau. »
    - Avertissement (orange) : « Onglet Financement : la LTV d'Arturo Soria 45 (52 %) approche le seuil de covenant (55 %). »
  - Aperçu sous forme d'onglets (Actifs, Lots, Baux, Locataires, Financement, Business plan) avec l'onglet « Actifs » affiché : un petit tableau des 3 actifs avec leur valeur (42,5 M€, 21,8 M€, 28,3 M€) et leurs loyers (2,14 M€, 1,09 M€, 1,48 M€).
- En bas à droite : bouton secondaire « Annuler » et bouton principal « Valider l'import » désactivé (grisé), avec l'infobulle « Corrigez l'erreur bloquante pour valider ».
- Encadré à droite « Derniers imports » : 14/10/2026 v3 · Validé ; 02/10/2026 v2 · Remplacé ; 28/09/2026 v1 · Remplacé.
```

---
