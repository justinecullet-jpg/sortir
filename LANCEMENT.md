# Plan de lancement : gratuit d'abord, rentable ensuite

*Rédigé le 06/11/2026. Les prix et les règles juridiques sont indiqués de mémoire : vérifie-les au moment d'agir.*

**Principe** : lancer vite et gratuitement, mais faire dès le départ les quelques choix qui coûteraient cher à changer plus tard, à savoir le **nom**, l'**adresse web** et un **hébergeur qui accepte l'usage commercial**.

---

## Étape 0 · Cette semaine : la bêta en ligne (≈ 1 h de ton côté, 0 €)

| ✔ | Action | Qui |
|---|---|---|
| ☐ | Créer un compte GitHub **perso** (gratuit, github.com/signup), pas celui de VOD Factory | toi |
| ☐ | Te connecter dans le terminal (`gh auth login`) : je te guide | toi |
| ☐ | Créer le dépôt, publier, vérifier le robot d'import (2 fois par jour) | moi |
| ☐ | Ajouter l'app à l'écran d'accueil de ton téléphone et l'utiliser 3 jours | toi |
| ☐ | Choisir l'icône (planche `design/comparatif-icones-2.png`) | toi |

L'adresse sera du type `https://<ton-pseudo>.github.io/sortir/`. Elle **changera** au lancement public (étape 2) : c'est sans gravité tant que seuls quelques potes l'utilisent.

## Étape 1 · Semaines 1 à 3 : bêta privée (0 €)

**Objectif** : 15 à 30 testeur·rices (potes, collègues, potes de potes), pour savoir si l'app donne envie de revenir.

- **Retours** : un bouton « Donner mon avis » qui ouvre un formulaire (Tally ou Google Forms, gratuits).
- **Contenu** : brancher **OpenAgenda** (banlieue) et **Ticketmaster** (concerts), avec une clé gratuite chacun que tu crées, et trouver une piste techno.
- **Mesurer sans cookies** : Cloudflare Web Analytics ou GoatCounter, gratuits. Sans cookie, pas besoin de bandeau de consentement.
- **Propreté RGPD** : héberger la police de caractères avec l'app au lieu de la charger chez Google Fonts. Ça évite d'envoyer l'adresse IP des visiteurs à Google. C'est 10 minutes de travail.
- **Pages légales** (une seule page « À propos ») :
  - *mentions légales* : en tant que particulier, tu peux ne publier que les coordonnées de l'hébergeur, s'il a ton identité ;
  - *confidentialité* : aujourd'hui, aucune donnée ne quitte le téléphone de l'utilisateur ;
  - *crédits* : sources des données (« Que faire à Paris », Ville de Paris), fond de carte (OpenFreeMap / OpenStreetMap) et photos (crédits des organisateurs).

**Indicateurs à suivre chaque semaine**

| Indicateur | Ce qu'il dit | Bon signe en bêta |
|---|---|---|
| Visiteurs qui reviennent la semaine suivante | l'app crée une habitude | > 30 % |
| Cartes swipées par visite | le contenu plaît | > 15 |
| Partages | le bouche-à-oreille fonctionne | 1 partage pour 5 visiteurs |
| **Clics « Billetterie »** | **ton futur revenu** (affiliation) | à mesurer dès maintenant |

## Étape 2 · Semaines 4 à 6 : lancement public (≈ 10 €/an)

C'est **le moment des choix définitifs**, parce que les liens partagés contiennent l'adresse de l'app : en changer plus tard casserait tous les liens.

1. **Nom définitif** : vérifier que le nom de domaine (`.fr`, ≈ 10 €/an), le compte Instagram/TikTok et la marque sont libres. Pour la marque, cherche sur data.inpi.fr.
2. **Passer sur Cloudflare Pages** (gratuit, usage commercial autorisé, pas de limite de trafic) avec ton nom de domaine. GitHub Pages interdit les sites commerciaux. Le robot d'import ne change pas, seule l'étape « publier » change : environ 30 minutes, que je fais.
3. **Aperçus de partage** : une image et un titre propres à chaque sortie quand on colle le lien dans WhatsApp. Cloudflare le permet avec une petite fonction gratuite.
4. **Acquisition, en partant d'une niche** (par exemple indé/techno ou un quartier) plutôt que de « tout Paris » :
   - un post hebdo « 5 sorties du week-end » sur Instagram/TikTok, que je peux générer automatiquement depuis les données ;
   - des partenariats avec 3 à 5 petits lieux : ils partagent l'app, tu mets leurs sorties en avant gratuitement ;
   - le partage entre potes, qui est déjà le moteur de l'app.

## Étape 3 · Mois 2 à 4 : préparer l'argent (≈ 200 à 400 € une fois)

**Déclencheur** : environ **1 000 utilisateurs actifs par semaine**, ou des lieux qui te demandent comment être mis en avant.

**Avant le premier euro**
- [ ] **Relire ton contrat de travail** (clause d'exclusivité, obligation de loyauté) : un projet perso rémunéré à côté d'un CDI est souvent possible, mais à vérifier.
- [ ] Créer une **micro-entreprise** : gratuit, sur formalites.entreprises.gouv.fr. Le plafond de chiffre d'affaires pour les services est de l'ordre de 77 000 €/an (à vérifier).
- [ ] Ouvrir un compte bancaire dédié.
- [ ] Déposer la **marque** à l'INPI : environ 190 € pour une classe, +40 € par classe en plus. Classes utiles : 9 (application), 35 (publicité), 41 (activités culturelles).
- [ ] **Droits** : les photos appartiennent aux organisateurs. En mode commercial, n'utilise que celles des partenaires qui t'envoient leurs visuels, et vérifie la licence des données « Que faire à Paris » pour un usage commercial.

**Les revenus, dans l'ordre**
1. **Affiliation billetterie** : le bouton Billetterie passe par un lien affilié et te rapporte une commission par billet vendu. C'est simple à brancher : il suffit de s'inscrire aux programmes d'affiliation des billetteries qui en ont un.
2. **Cartes sponsorisées** : une salle, un festival ou un distributeur de film paie pour apparaître dans la pile, ciblé par genre, quartier et date, sans aucune donnée personnelle. Pour démarrer :
   - je crée un fichier de « cartes sponsorisées » que tu remplis à la main, sans outil de vente ;
   - un **kit média** d'une page (audience, ciblage, prix) ;
   - un prix au forfait par semaine pour commencer, simple à vendre ;
   - la mention **« Sponsorisé »** obligatoire sur la carte. La publicité doit être identifiable, et le classement des cartes doit être transparent : à faire valider par un juriste.
   - des conditions générales de vente pour les annonceurs (modèle, puis relecture).
3. **Places de dernière minute** : une salle propose des places réduites pour le soir même, et tu prends une commission.

## Étape 4 · Mois 4 et plus : accélérer

- **Comptes et base de données** (Supabase, gratuit au départ) pour le volet social : « 3 potes ont dit oui », listes partagées, sortie de groupe. RGPD complet à ce stade : registre, consentement, suppression de compte.
- **Applis iPhone et Android** à partir du même code (Capacitor). Coût : compte Apple ≈ 99 $/an, Google Play ≈ 25 $ une fois. Seulement si le web ne suffit plus, par exemple pour les notifications iPhone.
- **Revenus B2B** : tendances agrégées pour les programmateurs, version personnalisée pour une ville ou un média.

---

## Budget

| Étape | Coût |
|---|---|
| 0 · Bêta en ligne | 0 € |
| 1 · Bêta privée | 0 € |
| 2 · Lancement public | ≈ 10 €/an (nom de domaine) |
| 3 · Monétisation | ≈ 190–270 € une fois (marque), 0 € de création d'entreprise, frais bancaires selon banque |
| 4 · Accélérer | 0 à ≈ 25 $/mois (base de données) + stores si besoin |

## Qui fait quoi

- **Toi seule** : créer les comptes (GitHub, Cloudflare, clés des sources, réseaux sociaux), payer le domaine et la marque, choisir le nom et l'icône, signer avec les partenaires, faire les démarches administratives.
- **Moi** : tout le code (sources, publication, aperçus, cartes sponsorisées, statistiques), les pages légales en brouillon, le kit média, les posts hebdo générés depuis les données.
