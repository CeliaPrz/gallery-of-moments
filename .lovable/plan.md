# Étape F5-a : rapport trimestriel (Administration › Rapports)

Aucune migration. Table `reports` et stockage « reports » existants. Style actuel conservé.

## 1. Nouvelle page `/rapports` (administratrice uniquement)
- Entrée « Rapports » de la barre latérale reliée à cette page ; un investisseur qui l'ouvre est renvoyé au tableau de bord.
- Sélecteur d'investisseur, tableau : trimestre, version, statut (Brouillon ambre, Validé vert, Envoyé vert foncé), date de validation, date d'envoi.
- Dernière version de chaque trimestre en évidence ; anciennes repliées dessous avec « Remplacée par la version {n} ».
- « Générer un rapport » : T1 à T4 + année, period_end = dernier jour du trimestre. Si un rapport validé ou envoyé existe déjà pour ce trimestre, le bouton devient « Corriger ce rapport ».

## 2. Écran d'un rapport (brouillon ou validé)
Contenu lu dans la base, sans calcul :
- Synthèse : portfolio_summary + date des données.
- Une section par actif en portefeuille : valeur, loyer, occupation, LTV (asset_summary), encours de chaque prêt, principales échéances de bail, BP en vigueur (rendement initial, TRI cible) — tout filtré sur l'import en vigueur.
- Alertes : mêmes règles que le tableau de bord (réutilisation du module existant).
- Sources : fichier, version et date de chaque import en vigueur.

## 3. Commentaire de gestion par l'IA
- « Rédiger le commentaire » puis « Régénérer ». Appel Anthropic dans une fonction serveur uniquement, avec `ANTHROPIC_API_KEY` (jamais côté navigateur).
- La fonction vérifie d'abord, avec le jeton de l'utilisateur, que le profil est administratrice active ; sinon refus.
- Données envoyées en JSON : synthèse, chiffres par actif, alertes, BP, noms des locataires en alerte. Jamais de contacts, e-mails ni NIF.
- Consigne système : votre texte, mot pour mot.
- Zone de texte modifiable, enregistrée dans reports.commentary (brouillon).
- Contrôle des chiffres : chaque nombre du commentaire est comparé aux valeurs envoyées (format français) ; un nombre absent est surligné en ambre avec « Chiffre absent des données du trimestre : à vérifier ». Validation toujours possible.

## 4. Validation et PDF
- « Valider le rapport » après confirmation : PDF généré dans le navigateur (@react-pdf/renderer), Manrope / Inter, vert #2E4738.
- Pied de chaque page : « Confidentiel — préparé pour {investisseur} — {date de validation} » + numéro de page.
- Dépôt `{investor_id}/{period_label}_v{version}.pdf` et `.json` (chiffres figés).
- Mise à jour : pdf_path, status valide, validated_at, validated_by ; corrected_at si c'est une correction.
- En cas d'échec : erreur rouge brique, le rapport reste brouillon.

## 5. Brouillon d'e-mail (aucun envoi)
- Objet « Rapport trimestriel {period_label} — {investisseur} », court texte (disponible dans LUR, PDF joint, confidentialité), signé « L'équipe de gestion ».
- Boutons « Copier », « Ouvrir dans ma messagerie » (mailto sans destinataire), « Marquer comme envoyé » (status envoye, sent_at).

## 6. Correction
- « Corriger ce rapport » : motif obligatoire ; nouvelle ligne version + 1, replaces_report_id, correction_reason, brouillon ; contenu relu dans les données en vigueur. L'ancienne version n'est jamais modifiée.

## Points à confirmer
- **Modèle** : « claude-sonnet-5-5 » n'existe pas dans la liste des modèles disponibles ; le plus proche est « claude-sonnet-5 ». J'utiliserai celui-ci sauf avis contraire.
- **Clé** : je vous demanderai la clé ANTHROPIC_API_KEY via le formulaire sécurisé. Alternative : les mêmes modèles Claude sont déjà intégrés à Lovable, facturés sur vos crédits, sans clé à gérer. Je pars sur votre clé.
- **« Principales échéances de bail »** : je prends les baux actifs dont la fin ou l'option de sortie tombe dans les 12 prochains mois (même règle que les alertes), sinon les 3 plus proches. À valider.
- **Texte de l'e-mail** : vous ne l'avez pas rédigé mot pour mot ; je l'écrirai à partir de vos éléments et vous le montrerai.

## Technique
- `src/lib/reports.ts` (pur, testé) : fin de trimestre, regroupement des versions, extraction et contrôle des nombres français, texte de l'e-mail.
- `src/lib/reports.functions.ts` : liste, création, correction, lecture du contenu, enregistrement du commentaire, génération IA, validation, marquer envoyé — toutes avec `requireSupabaseAuth` et vérification admin active.
- `src/routes/_authenticated/rapports.tsx` (+ composant PDF chargé à la demande). Ajout de `@react-pdf/renderer`, polices Inter / Manrope en fichiers locaux pour le PDF.
- Tests vitest : fin de trimestre, version la plus haute = référence, détection d'un chiffre absent, chemin de stockage commençant par investor_id.
