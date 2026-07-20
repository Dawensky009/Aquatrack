# Aqua Track

Application de suivi pour un kiosque de vente d'eau traitée par gallon, en Haïti.
Enregistrez la recette du jour, suivez vos réapprovisionnements, et sachez ce que
vous gagnez réellement sur chaque gallon.

Interface entièrement en français, montants en gourdes (HTG), pensée pour le
téléphone d'abord — et **fonctionnelle sans connexion internet**.

---

## Démarrer

```bash
npm install
npm run dev
```

L'application s'ouvre sur `http://localhost:5173`. Au premier lancement, elle se
remplit avec **60 jours de données de démonstration** pour que tous les écrans
aient quelque chose à montrer. Le bouton « Repartir de zéro » dans Réglages les
efface définitivement quand vous voulez commencer avec vos vrais chiffres.

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build — nécessaire pour tester la PWA |
| `npm test` | Tests des calculs métier |

---

## Comment ça marche

### Vous saisissez une seule fois par jour

Enregistrer chaque vente de 25 HTG au comptoir serait irréaliste : une centaine
de saisies par jour, et l'application serait abandonnée en une semaine. Vous
saisissez donc **le montant encaissé sur la journée**, et l'app en déduit les
gallons :

```
1 000 HTG encaissés ÷ 25 HTG le gallon = 40 gallons vendus
```

Les **dépenses**, elles, se saisissent une par une. Il n'y en a que deux ou trois
par mois, et chacune porte une date et un prix qui déterminent toute votre marge.

### Les dépenses en détail

Deux natures de dépense, deux formulaires :

- **Camion d'eau** — gallons reçus + prix. Saisissez soit le forfait du camion,
  soit le tarif au gallon : l'app calcule l'autre.
- **Achat matériel** — l'article acheté (« Bouchons », « Pompe »…), la quantité
  et le prix unitaire. Le total se calcule tout seul, et c'est le nom de
  l'article qui apparaît dans le journal — pas un douzième « Achat matériel »
  indistinct.

Les catégories sont modifiables dans Réglages : renommez-les, ajoutez-en,
changez leur couleur.

### Les reçus

Chaque dépense accepte des photos de reçus.

- **Photographier** — sur téléphone, ouvre directement l'appareil photo arrière.
  Un seul geste au moment de payer.
- **Choisir** — ouvre la galerie, et accepte plusieurs images d'un coup.

Sur ordinateur il n'y a **qu'un seul bouton** : l'attribut qui déclenche
l'appareil photo y est ignoré, et afficher « Photographier » sur une machine sans
caméra serait mensonger.

Un trombone 📎 apparaît dans le journal sur les dépenses justifiées, et un appui
sur la vignette affiche le reçu en plein écran.

Chaque photo est **redimensionnée à 1 600 px et réencodée en JPEG** avant d'être
stockée : un reçu passe de ~4 Mo à ~200 Ko, et le texte reste parfaitement
lisible. Sans cette compression, une douzaine de reçus saturerait le stockage du
navigateur et chaque envoi vers Supabase durerait des minutes sur une connexion
instable.

Les reçus sont **inclus dans la sauvegarde** exportée : restaurer un export rend
les chiffres *et* les preuves d'achat.

### Elle calcule votre marge réelle

```
Camion   1 200 gallons pour 9 000 HTG  →  coût  =  7,50 HTG le gallon
Vente                                  →  prix  = 25,00 HTG le gallon
                                          marge = 17,50 HTG le gallon
```

Deux marges sont affichées, et elles ne disent pas la même chose :

- **Marge actuelle** — calculée sur votre **dernier** prix d'achat. C'est celle
  qui vous dit s'il faut augmenter votre prix de vente maintenant.
- **Marge du mois** — calculée sur le coût **moyen pondéré** de tous vos achats
  de la période. C'est ce que vous avez réellement gagné.

Après une hausse de la compagnie, les deux divergent — et cet écart est
précisément l'information utile.

### Elle suit le rendement de chaque camion

L'écran Analytiques répond à la question qu'une marge moyenne ne peut pas
trancher : **« ce camion-là, il m'a rapporté combien ? »**

Chaque livraison est suivie de son arrivée à son épuisement — gallons écoulés,
revenu généré, marge réelle et durée d'écoulement — avec une barre de
progression qui montre d'un coup d'œil s'il reste de quoi tenir la semaine.

La répartition se fait **en FIFO** : l'eau la plus ancienne part la première,
comme dans une citerne qu'on remplit par le haut et qu'on vide par le bas.
Chaque journée est valorisée au prix **réellement obtenu ce jour-là**, donc une
hausse de votre prix de vente en cours d'écoulement est attribuée au bon camion.

Les gallons vendus qu'aucun camion enregistré n'explique — le stock qui existait
avant l'installation de l'app — sont signalés à part plutôt que noyés dans les
totaux.

**Appuyez sur une livraison** pour l'ouvrir. Vous y trouvez la chaîne complète :

- l'achat lui-même, avec ses photos de reçus ;
- **chaque journée de vente** qui a puisé dans ce camion, avec les gallons
  attribués et le montant ;
- **les autres dépenses** tombées pendant son écoulement ;
- le **bénéfice net** qui en reste réellement.

Une livraison est aussi accessible en appuyant sur sa ligne dans le journal.

> Sur le rattachement des dépenses : acheter une pompe n'est pas *causé* par un
> camion. L'app rattache chaque dépense au camion qui s'écoulait ce jour-là —
> c'est la seule règle qui donne un bénéfice par période sans jamais compter la
> même dépense deux fois. L'écran le dit explicitement.

### Elle projette votre fin de mois

L'écran Analytiques estime ce que vous aurez encaissé au 31, et **quand
commander votre prochain camion**.

La méthode tient en une phrase : chaque jour restant est projeté avec la moyenne
**de son jour de la semaine**. Un samedi rapporte ~50 % de plus qu'un mardi ;
projeter sur une moyenne globale donnerait un chiffre trop bas quand il reste
surtout des week-ends, trop haut dans le cas inverse. Même logique pour le
stock : on le consomme jour après jour au rythme réel de chaque jour, plutôt
qu'en divisant par une moyenne.

Deux garde-fous, parce qu'une prévision fausse est pire que pas de prévision :

- **Une fourchette, jamais un chiffre nu.** « Vous ferez 62 340 HTG » serait une
  fausse précision. L'app annonce un intervalle couvrant ~80 % des cas, calculé
  sur la dispersion réelle de vos journées.
- **La fiabilité est écrite noir sur blanc** — « Prévision peu fiable — 3
  journées observées ». Sur trois jours d'historique, une projection ne vaut
  rien ; le dire évite qu'on commande un camion sur la foi d'un chiffre inventé.

Le réalisé n'est **jamais** extrapolé : il est ajouté tel quel, seuls les jours à
venir sont estimés. Sur le graphique, le trait plein s'arrête à aujourd'hui et le
pointillé prend la suite.

### Elle vous prévient quand le prix monte

Au moment où vous saisissez un réapprovisionnement, l'app compare au précédent et
affiche l'écart **avant** que vous validiez :

> ⚠ En hausse : 7,50 HTG → 8,00 HTG/gallon (+6,7 %)

L'écran Analytiques trace l'évolution de ce prix **en escalier** : entre deux
livraisons le prix ne bouge pas, et une courbe lissée mentirait sur la donnée.

---

## Apparence

**Réglages → Apparence** propose **Clair**, **Sombre** et **Système**. « Système »
suit le réglage de votre téléphone et bascule tout seul le soir.

Le thème sombre n'est pas une inversion automatique du clair — inverser le noir
de marque donnerait un blanc éblouissant. Il est composé : la hiérarchie passe
par l'élévation (fond très sombre, cartes plus claires, carte principale plus
claire encore) et le bleu de marque est éclairci d'un cran pour rester lisible.

Le choix est enregistré sur l'appareil et **non synchronisé** : on ne veut pas le
même réglage sur un ordinateur en plein jour et sur un téléphone le soir.

## Le journal — deux vues

**Liste** et **Calendrier** répondent à deux questions différentes :

- **Liste** — « qu'est-ce que j'ai fait ? » Le détail chronologique, filtrable
  par revenus ou dépenses.
- **Calendrier** — **« qu'est-ce qui manque ? »** Une journée oubliée disparaît
  d'une liste ; dans une grille, c'est la case vide au milieu des autres. Sur une
  app dont tout dépend d'une saisie quotidienne, c'est la vue la plus utile.

Chaque case porte la recette du jour, une barre relative au meilleur jour du
mois, et jusqu'à deux pastilles : 🚚 **livraison**, 📦 **achat**, ⏱ **relevé de
compteur**. Au-delà de deux, une case de 45 px devient illisible et le
calendrier perd son intérêt de coup d'œil ; la livraison prime toujours.

Aujourd'hui et les jours à venir ne sont jamais marqués comme oubliés — la
journée n'est pas finie.

Navigation `‹ mois ›`, et le libellé central ouvre une sélection **année + mois**
pour remonter loin sans dizaines de taps.

## Verrouillage

**Réglages → Sécurité** : code à 4 chiffres, avec un délai au choix —
**Immédiat**, **1 minute** ou **5 minutes** d'inactivité. Un démarrage complet
verrouille toujours.

Sur un appareil équipé, l'**empreinte ou le visage** (WebAuthn) déverrouille sans
saisir le code. Elle est proposée d'elle-même à l'ouverture ; le code reste
toujours disponible en secours, car un capteur refuse volontiers un doigt
mouillé — ce qui arrive au comptoir.

Le code **n'est jamais stocké** : seule son empreinte PBKDF2 (150 000 itérations)
et un sel aléatoire. Ces champs restent locaux et ne sont jamais synchronisés.

> ⚠️ **Ce que ce verrou protège, et ce qu'il ne protège pas.** Il arrête celui qui
> attrape le téléphone posé sur le comptoir — le risque réel dans un kiosque. Il
> n'arrête pas quelqu'un qui a le téléphone déverrouillé et sait ouvrir les
> outils de développement : les données restent en clair dans IndexedDB. Les
> chiffrer imposerait un mot de passe à chaque lecture, ce qui rendrait la saisie
> quotidienne insupportable ; et chiffrer avec une clé rangée à côté ne
> protégerait personne tout en donnant l'illusion du contraire. Gardez aussi le
> téléphone protégé par le verrouillage du système.

## Le compteur d'eau

**Important à comprendre.** Tant que votre compteur physique n'est pas installé,
les gallons affichés sont **déduits du montant encaissé** — ce n'est pas une
mesure indépendante. Concrètement : si de l'eau fuit, est offerte ou disparaît,
le stock affiché restera parfait. Vous voyez ce que vous *devriez* avoir, pas ce
que vous avez.

Le jour où le compteur est posé :

1. Allez dans **Réglages → Compteur d'eau**
2. Activez l'interrupteur **« J'ai un compteur d'eau »**
3. Saisissez le relevé actuel comme index de départ

À partir de là, la clôture demande le relevé du compteur, les gallons sont
**mesurés**, et l'app peut enfin détecter les écarts :

> ⚠ 220 gallons débités pour 5 000 HTG — il manque 500 HTG (22,73 HTG/gallon réel)

**Rien à migrer** : les journées passées gardent leurs valeurs, les nouvelles sont
marquées comme mesurées.

---

## Vos données

Elles vivent **dans le navigateur de votre téléphone** (IndexedDB). L'application
fonctionne donc intégralement sans réseau — vous pouvez clôturer une journée en
pleine coupure, tout est enregistré.

> ⚠️ **Sans synchronisation, perdre le téléphone = perdre les données.**
> Exportez régulièrement depuis **Réglages → Exporter**.

### Exporter et importer

**Réglages → Exporter** propose trois formats, qui ne servent pas à la même chose :

| Format | Pour quoi | Contient les reçus |
|---|---|---|
| **JSON** — sauvegarde complète | Restaurer, changer de téléphone | ✅ oui |
| **Recettes (CSV)** | Ouvrir dans Excel, donner au comptable | ❌ non |
| **Dépenses (CSV)** | Idem, avec catégorie et nombre de reçus | ❌ non |

**Seul le JSON est une vraie sauvegarde.** Un tableur ne sait pas transporter
d'images : un aller-retour par CSV perd les photos de reçus. L'écran le dit
plutôt que de garder la surprise pour le jour de la restauration.

**Importer** accepte les trois : le format est reconnu à la lecture, et le type
de CSV déduit de sa ligne d'en-tête. Les lignes douteuses sont **écartées et
listées** — jamais devinées : mieux vaut vous rendre la main que d'inventer un
chiffre comptable.

Les CSV sont écrits pour Excel en français : **BOM UTF-8** (sans lui les accents
sont cassés), **point-virgule** en séparateur, **virgule décimale**. À la lecture
l'app est permissive — séparateur deviné, point ou virgule acceptés — pour qu'un
fichier retouché sur un autre poste revienne sans difficulté.

Chaque ligne porte son **identifiant** en dernière colonne. Il n'intéresse
personne à la lecture, mais c'est lui qui permet de réimporter un fichier corrigé
sans créer de doublons.

### Sauvegarde vers Supabase (facultatif)

1. Créez un projet sur [supabase.com](https://supabase.com) (le plan gratuit suffit)
2. Ouvrez **SQL Editor** et exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql)
3. Créez un bucket **privé** nommé `recus` dans *Storage* (voir la section
   « STOCKAGE DES IMAGES » du même fichier) — sinon les photos de reçus restent
   uniquement sur le téléphone
4. Copiez `.env.example` en `.env` et remplissez les deux valeurs
   (dashboard Supabase → *Settings* → *API*)
5. Redémarrez `npm run dev`

Le badge en haut de l'écran passe alors de « Local » à « À jour ». Hors-ligne, il
affiche le nombre de saisies en attente, qui partent automatiquement au retour du
réseau.

> 🔒 **À faire avant tout usage réel.** Le schéma livré autorise la clé anonyme à
> tout lire et tout écrire. Cette clé est visible dans le code envoyé au
> navigateur : **quiconque l'obtient peut lire toute votre comptabilité.** La
> section « VARIANTE SÉCURISÉE » à la fin de `schema.sql` explique comment
> ajouter une authentification.

> ℹ️ Sur le plan gratuit, un projet Supabase **se met en pause après 7 jours
> d'inactivité** et doit être réactivé depuis le dashboard. Vos données locales,
> elles, restent accessibles quoi qu'il arrive.

---

## Installer l'app sur le téléphone

L'application s'installe comme une application native : icône sur l'écran
d'accueil, plein écran sans barre d'adresse, et **démarrage sans connexion**.

**Android / Chrome** — une bannière « Installer » apparaît au deuxième lancement.
Sinon : menu ⋮ → *Installer l'application*.

**iPhone / Safari** — iOS ne permet pas l'installation automatique. Appuyez sur
**Partager** (l'icône de partage), puis **Sur l'écran d'accueil**.

---

## Architecture

```
src/
├── lib/
│   ├── db.js        IndexedDB — LA SOURCE DE VÉRITÉ
│   ├── metrics.js   Tous les calculs métier (module pur, testé)
│   ├── sync.js      Envoi vers Supabase, en arrière-plan
│   ├── seed.js      Données de démonstration
│   └── format.js    Gourdes, dates et nombres en français
├── store/           État de l'app (Zustand)
├── components/      Cartes, graphiques, feuilles de saisie
├── pages/           Les cinq écrans
└── styles/
    └── tokens.css   ⚠️ Toutes les valeurs de design sont ici
```

Sur ordinateur, le bouton **« + Ajouter » vit dans l'en-tête de page**, pas dans
la barre latérale. Deux pilules pleine largeur empilées s'y disputaient
l'attention, et l'onglet actif y perdait son rôle d'indicateur de position ;
surtout, on consulte plus qu'on ne saisit sur grand écran — la saisie se fait au
comptoir, sur le téléphone, où le bouton flottant reste sous le pouce.

Deux règles tenues partout :

1. **L'interface ne parle jamais à Supabase.** Elle écrit dans IndexedDB ; la
   synchronisation est un processus de fond indépendant. Si le serveur est
   injoignable, ou absent, rien ne change pour l'utilisateur.
2. **Le style vient de `tokens.css`.** Les couleurs et la typographie sont issues
   de `Ressources/brading.png` (Readex Pro, `#2672DD`, `#222026`, `#F3F3F3`), et
   la mise en page de `Ressources/all_screen.png`. Ajuster le design se fait dans
   ce seul fichier.

   Les composants n'utilisent **jamais** une couleur de marque directement : ils
   passent par des jetons sémantiques (`--surface`, `--action`, `--accent`,
   `--hero`…). C'est ce qui permet aux deux thèmes de coexister sans qu'une
   seule ligne de composant soit dupliquée.

### Choix de conception à connaître avant de modifier le code

- **`prix_reference` est stocké sur chaque journée.** Si vous passez votre prix de
  vente de 25 à 30 HTG, les journées déjà clôturées gardent leur 25. Sans cela,
  changer un réglage réécrirait tout l'historique des gallons.
- **Les moyennes de prix sont pondérées par les volumes.** 1 200 gallons à 7,00
  puis 600 à 8,00 donnent **7,33 HTG**, pas 7,50. Une moyenne simple fausserait
  silencieusement toute la marge — c'est le premier test du fichier de tests.
- **Les suppressions sont logiques** (`deleted: true`), pour qu'une suppression
  faite hors-ligne se propage au serveur.
- **Le service worker ne met jamais Supabase en cache.** Servir une réponse d'API
  périmée entrerait en conflit avec IndexedDB.
- **Les images de reçus sont dans un magasin séparé de leurs métadonnées.**
  `chargerTout()` ne lit que les métadonnées ; sans cette séparation, chaque
  rafraîchissement de l'état chargerait plusieurs Mo en mémoire.
- **Les reçus se téléversent dans une passe distincte de l'outbox.** Une image
  pèse mille fois une ligne de données : les mélanger ferait attendre vos
  chiffres derrière une photo sur une connexion faible.
- **Le CSV des dépenses porte une colonne « Type ».** Sans elle, réimporter
  après un effacement recréerait « Camion d'eau » comme un achat ordinaire :
  les gallons cesseraient d'alimenter le stock et la marge tomberait à zéro,
  sans le moindre message d'erreur.
- **Les couleurs de catégorie sont transposées à l'affichage, jamais en base.**
  Le noir de marque serait invisible sur une carte sombre ; `couleurDonnees()`
  dans `lib/theme.js` s'en charge au rendu. Un export reste donc identique quel
  que soit le thème actif.

---

## Tests

```bash
npm test
```

87 tests couvrent `metrics.js`, `format.js` et `csv.js` : bénéfice net, coût moyen pondéré,
les deux marges, stock, historisation du prix de vente, écart de caisse en mode
compteur, comparaison mois à mois à durées égales, et les cas dégénérés — qui
doivent renvoyer `null`, jamais `NaN`.

Treize d'entre eux protègent la **répartition FIFO** par livraison, parce que
c'est le calcul qui se tromperait le plus silencieusement : consommation d'un
camion avant le suivant, vente antérieure à une livraison, surplus vendu,
changement de prix en cours d'écoulement, journée partagée entre deux camions,
rattachement des dépenses sans doublon — et surtout la vérification que **la
somme des revenus attribués égale exactement le total encaissé**.

Dix-sept autres protègent les **échanges CSV** : présence du BOM, champs
contenant un point-virgule ou un guillemet, saut de ligne à l'intérieur d'un
champ, séparateur deviné, espaces insécables dans les nombres, et l'aller-retour
complet sur les colonnes réelles.
