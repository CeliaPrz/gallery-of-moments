En attente des 4 écrans HTML

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

Prochaine étape : recevoir les 4 messages HTML, puis détailler le plan écran par écran (correspondance de chaque chiffre avec sa source de données, contrôle d'accès à la page Import à partir des rôles déjà existants dans Supabase, après vérification en lecture seule).
