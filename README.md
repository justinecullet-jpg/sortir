# Sortir : swipe tes sorties à Paris (prototype v1.4, 06/11/2026)

> **Journal** · v1 : swipe, filtres, liste, partage · v1.1 : calendrier dans « Mes sorties » · v1.2 : « Ajouter à mon agenda » · v1.3 : vue Carte, affichage tablette et ordinateur, robot de mise en ligne · v1.4 : filtre accessibilité, lieux de la Ville de Paris, page « À propos » (crédits, confidentialité, mentions légales), police et carte hébergées avec l'app
>
> **Plan de lancement** (gratuit puis rentable) : voir [LANCEMENT.md](LANCEMENT.md)

Une app web pensée pour le mobile. On choisit **quand**, **où** et **quoi** (concert, cinéma, expo, event + genres), puis on swipe :

| Geste | Bouton | Clavier | Effet |
|---|---|---|---|
| ➡️ à droite | ♥ Oui | → | ajouté à « Mes sorties » |
| ⬆️ vers le haut | ? Pourquoi pas | ↑ | gardé de côté |
| ⬅️ à gauche | ✕ Non | ← | écarté (récupérable dans les filtres) |
| | ↺ | Retour arrière | annule le dernier swipe |

**🗺️ Carte** (bouton « Carte » sous l'en-tête) : les mêmes sorties filtrées, regroupées par lieu.
- Une pastille par lieu, à la couleur de la catégorie et avec le nombre de sorties. Les lieux proches se regroupent en ronds blancs (touche pour zoomer). Un anneau vert ou jaune marque un lieu où tu as dit oui ou pourquoi pas.
- Toucher un lieu ouvre sa fiche : liste des sorties avec ✕ / ? / ♥, et « Détails ». Le bouton ◎ centre la carte sur toi.
- Le fond de carte vient d'OpenFreeMap (données OpenStreetMap) : gratuit, sans clé, usage commercial permis.

**Tablette et ordinateur**
- *Tablette* : colonne élargie, cartes centrées, listes sur deux colonnes.
- *Ordinateur* (≥ 1000 px) : la pile à gauche et la carte à droite. La carte se recentre sur le lieu de la sortie du dessus à chaque swipe. Dans « Mes sorties », le calendrier est à gauche et la liste à droite.

**Mes sorties** regroupe les « Oui » et les « Pourquoi pas » (onglets Tout / Oui / Pourquoi pas) :
- un **calendrier du mois** avec une pastille par sortie (verte = oui, jaune = pourquoi pas). Une sortie qui joue plusieurs soirs a une pastille sur chacune de ses dates ;
- toucher un jour n'affiche que ce jour-là, plus les expos ouvertes ce jour-là (« À voir aussi ce jour-là ») ;
- sans jour choisi, la liste est **rangée par jour** (« Demain · sam. 7 nov. », avec l'heure sur chaque sortie). Ensuite viennent les sorties **sur plusieurs jours**, triées par date de fin, puis les passées.

**📅 Ajouter à mon agenda** (bouton sur la fiche et sur chaque sortie de « Mes sorties ») :
- on choisit **sa** date : un créneau pour une pièce qui joue plusieurs soirs, ou un jour pour une expo ;
- **Google Agenda** ouvre l'événement prérempli. **Apple / Outlook** télécharge un fichier `.ics` (heure de Paris, rappel 2 h avant, lien billetterie dans la note) ;
- la date choisie est **retenue** : la sortie se range à ce jour-là dans « Mes sorties », avec une seule pastille dans le calendrier et la mention « 📅 dans ton agenda ». Une sortie pas encore swipée passe automatiquement en « Oui ».

**♿ Accessibilité** (section des filtres) : fauteuil roulant ♿, malvoyant·es 👁️, malentendant·es 🧏, langue des signes 🤟, handicap mental 🧠. Les pictos apparaissent aussi sur les cartes et les fiches.
- L'info vient des organisateurs (champs `pmr`, `blind`, `deaf`, `sign_language`, `mental` de « Que faire à Paris »). Une sortie sans picto n'est pas forcément inaccessible : l'info n'a pas été donnée, et l'app le dit.
- Plusieurs critères cochés = la sortie doit les remplir tous.

**🏛️ Lieux de la Ville de Paris** (option des filtres, badge « Lieu municipal ») : bibliothèques, conservatoires, centres Paris Anim', parcs, musées de la Ville (Paris Musées) et établissements culturels municipaux (Centquatre, Gaîté Lyrique, Carreau du Temple, Théâtre de la Ville, Châtelet…). La liste se règle dans `LIEUX_VILLE` de `public/config.js`. Simple filtre, sans favoritisme dans l'ordre de la pile.

**ℹ️ À propos** (`#/apropos`, lien dans les filtres et sur chaque fiche) : d'où viennent les données et sous quelle licence, crédits (photos, carte, police), ce que l'app fait de tes données (rien ne sort du téléphone), un bouton pour tout effacer, et les mentions légales.

Chaque carte affiche l'image, la date, le lieu, l'arrondissement, les genres et un bouton **Billetterie**. Le bouton **Partager** crée un lien (WhatsApp, SMS ou copie) qui ouvre la fiche chez les potes avec « *Prénom* te propose cette sortie », et ils peuvent répondre Oui / Pourquoi pas / Non.

## Lancer en local

```bash
cd ~/Desktop/sortir-app
node ingest/run.mjs                        # récupère les événements → public/data/events.json
python3 -m http.server 5173 -d public      # puis ouvrir http://localhost:5173
```

Pour tester en vrai sur ton téléphone, il faut mettre l'app en ligne : les liens partagés pointent vers l'adresse de l'app, donc `localhost` ne marche que sur ton ordinateur.

## Mise en ligne et import automatique (en ligne depuis le 06/11/2026)

👉 **https://justinecullet-jpg.github.io/sortir/** · dépôt : https://github.com/justinecullet-jpg/sortir · suivi du robot : onglet *Actions* du dépôt.

Hébergement : **GitHub Pages**, gratuit pour un dépôt public. Le jeton d'accès utilisé pour publier depuis le Mac expire le **04/02/2027** : il faudra le régénérer (même réglages) à cette date.

Le robot `.github/workflows/mise-a-jour.yml` tourne sur les serveurs de GitHub, même ordinateur éteint :
1. **deux fois par jour** (5h et 16h à Paris en hiver), à chaque modification du code, ou à la main (bouton *Run workflow* dans l'onglet *Actions*) ;
2. il lance `node ingest/run.mjs` : il interroge les sources, refait `events.json` et calcule les nouveautés ;
3. il enregistre `ingest/first_seen.json` (la mémoire des nouveautés) dans le dépôt ;
4. il republie le site avec les données fraîches.

**Garde-fou** : si une source est en panne, ou si le nombre de sorties chute de plus de moitié, rien n'est publié. La version de la veille reste en ligne et GitHub t'envoie un e-mail d'échec.

**Si GitHub Pages cale** (c'est arrivé le 06/11/2026 : publication restée « en cours » 10 min, sans erreur de notre côté) : le robot abandonne au bout de 5 min et retente une fois. Si le 2e essai échoue aussi, la version précédente reste en ligne et le passage suivant (12 h plus tard) republie tout.

`public/data/events.json` n'est pas versionné (voir `.gitignore`) : le robot le refabrique à chaque fois, ce qui garde le dépôt léger.

Les choix des utilisateur·rices (oui / pourquoi pas / non, agenda) restent stockés **dans leur navigateur**. Il n'y a pas encore de compte ni de base partagée.

## Licences et vie privée

- **Données** : « Que faire à Paris » est sous **licence ODbL**. L'usage, y compris commercial, est permis à deux conditions : citer la source (« Ville de Paris – Que faire à Paris », fait dans les filtres, sur chaque fiche et dans « À propos ») et publier la base dérivée sous la même licence (`data/events.json`, mentionné dans « À propos »).
- **Aucun appel à Google ni à un CDN** : la police (Bricolage Grotesque, licence OFL, `public/fonts/`) et la carte (MapLibre GL 4.7.1, licence BSD, `public/vendor/maplibre-gl/`, vérifiée contre l'empreinte cdnjs) sont servies par l'app. Les seuls serveurs extérieurs contactés sont `cdn.paris.fr` (photos) et `tiles.openfreemap.org` (fond de carte, quand on ouvre la carte).
- **Pas de cookie ni de mesure d'audience**, donc pas de bandeau de consentement. Si on ajoute des statistiques, choisir un outil sans cookie et mettre à jour « À propos ».
- **Mentions légales** : éditeur particulier anonyme (permis par la LCEN), hébergeur GitHub. À revoir au passage en micro-entreprise : les mentions deviennent alors complètes (nom, adresse, SIRET).

## Comment c'est construit

```
Sources en ligne ──► ingest/ (Node, 1×/jour) ──► public/data/events.json ──► app (public/)
  Que faire à Paris     normalise, catégorise,       un seul format            filtres, swipe,
  (+ futures sources)   tague, dédoublonne                                     listes, partage
```

| Fichier | Rôle |
|---|---|
| `public/config.js` | **Catégories, tags de genre, options et zones. C'est le fichier à modifier pour ajouter un genre** (ex. `{ id: 'drill', label: 'Drill', re: 'drill' }`). |
| `ingest/sources/*.mjs` | Un fichier par source, qui la traduit dans le format commun. |
| `ingest/run.mjs` | Fusionne les sources, calcule zones, tags et « nouveautés », écrit `events.json`. |
| `ingest/first_seen.json` | Date de première apparition de chaque événement (sert au tag « Nouveauté »). |
| `public/app.js` | L'app : filtres, pile de cartes, swipe, listes, fiche, partage, carte, « À propos ». |
| `public/fonts/`, `public/vendor/` | Police et bibliothèque de carte hébergées avec l'app, avec leurs licences. |

Les choix (oui / pourquoi pas / non), les filtres et le prénom sont stockés **dans le navigateur** (pas de compte pour l'instant).

### Règles actuelles
- **Tags de genre** : un événement a le tag si la source lui donne déjà ce tag (`src`) ou si un mot-clé (`re`) apparaît dans son titre ou sa description. Dans une catégorie, plusieurs genres cochés = l'un **ou** l'autre.
- **Options** (Nouveautés, Gratuit, Avec billetterie) : elles se cumulent (filtres « ET »).
- **Nouveauté** : apparu dans les sources depuis moins de 7 jours, ou mots-clés « avant-première », « inédit », « nouvel album »…
- **Lieu** : déduit du code postal (75001–75020 → arrondissement ; 92 / 93 / 94 → petite couronne ; 77 / 78 / 91 / 95 → grande couronne). Rien de coché = partout.
- **Écartés à l'import** : ateliers, stages, cours, sport, jeune public, et hors expos les offres de plus de 90 jours (visites permanentes, agendas de saison).
- **Ordre de la pile** : les catégories alternent (concert, ciné, expo, event…), et chacune est triée par date.

## Sources

| Source | État | Ce qu'elle apporte | Accès |
|---|---|---|---|
| **Que faire à Paris** (Ville de Paris, open data) | ✅ branchée | ~1 650 sorties sur 120 jours, avec image, billetterie, adresse et tags | API ouverte, sans clé |
| OpenAgenda | à brancher | agendas des villes et des lieux, **bien pour la banlieue** | clé gratuite |
| Ticketmaster Discovery API | à brancher | gros concerts et spectacles, liens billetterie | clé gratuite (quota/jour) |
| TMDB « à l'affiche » | à brancher | films en salle, affiches, genres (pas les horaires de séance) | clé gratuite |
| Resident Advisor / Shotgun / DICE | à étudier | **techno, club, indé** | pas d'API publique ouverte : partenariat ou autre accord à trouver, CGU à vérifier |
| Séances de cinéma | à étudier | horaires par salle | pas d'API publique gratuite connue, à creuser |

Pour ajouter une source : copier `ingest/sources/quefaireaparis.mjs`, adapter `fetchEvents()` pour qu'il renvoie le même format, puis l'ajouter à `SOURCES` dans `ingest/run.mjs`.

## Limites connues (v1)
- **Techno** : seulement 8 événements. La Ville de Paris couvre peu la scène club, et il faut une source dédiée (ligne RA / Shotgun ci-dessus).
- **Cinéma** : ce sont des projections événementielles (festivals, ciné-débats, bibliothèques), pas encore les films à l'affiche.
- **Banlieue** : environ 70 événements seulement, OpenAgenda comblera ce trou.
- `events.json` pèse ~3 Mo (≈ 700 Ko compressé par l'hébergeur). Ça va pour un prototype, mais ensuite il faudra une petite API.
- L'aperçu d'un lien partagé (WhatsApp, iMessage) est générique : un aperçu par événement demande un petit serveur.

## Suite proposée
1. **Mise en ligne** : faite le 06/11/2026 (voir plus haut).
2. **Sources** : OpenAgenda (banlieue), Ticketmaster (concerts), TMDB (films à l'affiche), puis une piste techno.
3. **Social** : voir ce que les potes ont swipé sur un même événement (« 3 potes ont dit oui »), ce qui demande des comptes et une petite base de données.
4. **App native** si besoin (Capacitor ou React Native à partir de la même logique).
