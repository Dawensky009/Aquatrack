# Plan marketing — Aqua Track

Vendre l'application à d'autres propriétaires de kiosques d'eau en Haïti.

**Statut :** v1, à valider sur le terrain. Les chiffres marqués *(estimation)*
doivent être confirmés avant d'engager du budget.

---

## Ce que le plan tranche

| Question | Réponse retenue |
|---|---|
| À qui vendre en premier ? | Propriétaires de kiosques d'eau à Port-au-Prince, 1 à 3 points de vente |
| Combien facturer ? | **500 HTG/mois** ou **5 000 HTG/an** par kiosque, essai gratuit 30 jours |
| Comment vendre ? | Terrain + WhatsApp, en grappes de quartier — pas de vente en ligne pure |
| Quel est l'atout décisif ? | Ton kiosque pilote et ses chiffres réels |
| Où est le vrai levier de croissance ? | Le parrainage, puis les **compagnies de camions d'eau** |

---

## 1. Le client idéal (ICP)

Ne vise pas « les entrepreneurs ». Vise **une seule personne** :

> **Propriétaire d'un kiosque d'eau traitée**, à Port-au-Prince ou dans une
> grande ville, qui vend **30 à 100 gallons par jour**, possède **1 à 3 points
> de vente**, a un **smartphone Android**, et tient ses comptes **dans un cahier
> ou de tête**.

**Ses trois douleurs, dans l'ordre :**

1. **« Je ne sais pas si je gagne. »** Il connaît sa recette du jour. Il ne
   connaît pas sa marge, parce qu'elle dépend du prix du dernier camion — et ce
   prix bouge.
2. **« Je ne sais pas si on me vole. »** Un employé au comptoir, une centaine de
   ventes par jour, aucune trace. L'écart ne se voit jamais.
3. **« Je commande mon camion au hasard. »** Trop tôt, il immobilise son argent.
   Trop tard, il ferme deux jours et ses clients vont chez le voisin.

**Le moment où il achète (l'évènement déclencheur).** Personne n'achète un
logiciel un mardi sans raison. Il achète quand :

- la compagnie **augmente le prix du camion** et qu'il ne sait pas de combien
  augmenter le sien ;
- il **ouvre un deuxième kiosque** et perd le contrôle du premier ;
- il **soupçonne un employé** ;
- il **cherche un crédit** et n'a aucun chiffre à montrer.

👉 **Conséquence pratique :** ton argumentaire terrain doit commencer par une
question, pas par une démo. *« La dernière fois que le camion a augmenté, vous
avez augmenté votre prix de combien ? »* S'il hésite, tu as ton client.

**Qui ne PAS viser au départ :** les très gros distributeurs (ils ont déjà un
comptable), les kiosques sans smartphone, les vendeurs ambulants.

---

## 2. Positionnement

La formule, à apprendre par cœur :

> **Aqua Track, c'est le cahier de comptes qui calcule tout seul, fait pour les
> kiosques d'eau haïtiens.**
> Contrairement au cahier ou à Excel, il vous dit **ce que vous gagnez sur chaque
> gallon**, **quand commander le prochain camion**, et il **marche sans
> internet**.

Les trois différenciateurs, par ordre de force :

| Différenciateur | Pourquoi il tient |
|---|---|
| **Fait pour ce métier précis** | Il parle gallons, camions, gourdes. Aucun concurrent générique ne fait ça. |
| **Marche sans connexion** | Décisif en Haïti. À dire dès la première phrase. |
| **Une seule saisie par jour** | La raison pour laquelle il ne sera pas abandonné en une semaine. |

**Ce qu'il ne faut pas dire :** « application de gestion », « solution digitale »,
« optimisez votre business ». Ces mots ne veulent rien dire au comptoir. Dis :
*« vous saisissez ce que vous avez encaissé, l'app vous dit ce que vous
gagnez. »*

---

## 3. Le prix — et pourquoi celui-là

### La recommandation

| | Prix | Note |
|---|---|---|
| **Essai** | Gratuit, **30 jours** | Assez long pour couvrir un cycle de camion complet |
| **Mensuel** | **500 HTG / mois / kiosque** | Payé par MonCash |
| **Annuel** | **5 000 HTG / an** | 2 mois offerts — et l'argent rentre d'avance |

### Le raisonnement

Un kiosque qui vend 40 gallons/jour à 25 HTG encaisse ~30 000 HTG/mois et
dégage ~21 000 HTG de marge brute. **500 HTG, c'est 2,4 % de sa marge.** C'est
sous le seuil de douleur.

Mais l'argument de vente n'est pas le pourcentage — c'est celui-ci :

> Quand la compagnie passe le gallon de 7,50 à 8,00 HTG et que vous ne le
> remarquez pas, vous perdez **600 HTG ce mois-là**. Aqua Track vous le dit
> avant que vous validiez l'achat.
> **L'application coûte moins cher qu'une seule hausse ratée.**

Ce n'est pas un argument théorique : c'est exactement ce que fait l'écran de
réapprovisionnement.

### Pourquoi l'abonnement plutôt que la licence unique

Une licence unique (5 000 HTG une fois) se vend plus facilement — mais elle te
condamne à re-vendre à un nouveau client chaque mois pour maintenir ton revenu,
et elle ne finance pas le support ni l'hébergement Supabase. L'abonnement annuel
prépayé te donne **la facilité de vente de la licence unique et le récurrent de
l'abonnement**. C'est pour ça qu'il est mis en avant.

### Ce que ce prix implique côté produit

⚠️ **À construire avant de vendre :** l'application fonctionne hors ligne, donc
rien n'empêche aujourd'hui de l'utiliser sans payer. Il faut une **vérification
d'abonnement en ligne périodique** (par exemple : l'app tolère 14 jours hors
ligne, puis exige une connexion pour se revalider). Supabase est déjà en place,
c'est faisable — mais ce n'est pas fait.

### Le prix reste à valider

Ne grave pas 500 HTG dans le marbre. Pendant la phase pilote, pose la question à
chaque propriétaire : *« à combien par mois est-ce que ça vaudrait le coup pour
vous ? »* et **note le chiffre**. Dix réponses valent mieux que ce raisonnement.

---

## 4. Le marché *(estimations à confirmer)*

Calcul par le bas, à partir des chiffres de ton kiosque :

```
Un kiosque sert ~40 gallons/jour  ≈  ~80 foyers
Zone métropolitaine de Port-au-Prince  ≈  2,8 M habitants  ≈  560 000 foyers
Si ~60 % achètent leur eau traitée au gallon  →  ~336 000 foyers
336 000 ÷ 80  ≈  4 200 kiosques dans l'aire métropolitaine
```

- **Marché total Haïti :** ~10 000 à 15 000 kiosques *(estimation)*
- **Marché adressable** (smartphone + volonté de tenir des comptes, ~25 %) :
  **~1 000 à 1 500 kiosques à Port-au-Prince**
- **Objectif réaliste an 1 :** **100 à 200 kiosques payants**

### Ce que ça donne en argent — sois lucide

| Kiosques payants | Revenu mensuel | ≈ USD/mois |
|---|---|---|
| 50 | 25 000 HTG | ~180 $ |
| 200 | 100 000 HTG | ~720 $ |
| 1 000 | 500 000 HTG | ~3 600 $ |

👉 **Le message important :** au prix haïtien, ce marché seul est un **revenu
d'appoint**, pas une entreprise. La valeur du beachhead haïtien n'est pas
l'argent — c'est **la preuve** : 200 kiosques qui paient, c'est ce qui te permet
ensuite d'ouvrir l'Afrique francophone (Sénégal, Côte d'Ivoire, RD Congo — même
métier, même langue, même problème) ou d'adapter l'app à d'autres micro-commerces
haïtiens. **Gagne Port-au-Prince d'abord, mais sache pourquoi tu le gagnes.**

---

## 5. Les canaux, par ordre de priorité

### 🥇 1. Le terrain, en grappes de quartier — *canal principal*

À 500 HTG/mois, une visite commerciale ne se rentabilise que si tu en fais
**beaucoup dans peu d'espace**. Les kiosques sont denses : tu peux en visiter
8 à 12 par jour à moto dans un même quartier.

**Ne vends pas quartier par quartier au hasard — sature un quartier à la fois.**
Trois raisons : le bouche-à-oreille circule entre voisins, tes visites de suivi
coûtent moins cher, et un quartier où « tout le monde l'utilise » se vend tout
seul.

**Le script de visite, en 4 temps (5 minutes) :**

1. **La question** — *« Le camion a augmenté le mois dernier, non ? Vous avez
   augmenté votre prix de combien ? »*
2. **Le silence** — laisse-le répondre. C'est là qu'il réalise qu'il ne sait pas.
3. **La démo sur TON téléphone, 60 secondes** — ouvre l'écran Analytiques du
   kiosque pilote. Montre la marge réelle et la courbe du prix d'achat en
   escalier. Ne montre rien d'autre.
4. **L'offre** — *« Essayez 30 jours gratuitement. Je reviens dans deux semaines
   voir vos chiffres avec vous. »*

⚠️ **Le piège à éviter :** ne le laisse pas installer l'app seul. **Installe-la
avec lui et saisis ensemble sa journée d'hier.** Un kiosque qui n'a pas fait sa
première saisie devant toi ne la fera jamais.

### 🥈 2. WhatsApp — *canal principal*

C'est là que se passe le commerce en Haïti.

- **Statut WhatsApp**, 2 à 3 fois par semaine : une capture d'écran + une phrase.
  Pas de publicité, du concret. *« Ce camion-là a rapporté 14 200 HTG net. »*
- **Groupes** de commerçants et d'associations de quartier.
- **Un groupe « Utilisateurs Aqua Track »** dès les premiers clients : c'est ton
  support, ton canal de mises à jour, et ta preuve sociale au même endroit.
- **Diffusion** aux prospects visités mais non convertis, une fois par mois.

### 🥉 3. Publicité Facebook géociblée — *amplification, pas fondation*

Tu as du budget : garde-le pour **après** avoir validé le discours sur le terrain.
Faire de la pub avant d'avoir un message qui convertit en face-à-face, c'est
payer pour diffuser un message qui ne marche pas.

- **Ciblage :** Port-au-Prince + villes principales, 25-55 ans, centres d'intérêt
  petit commerce / entrepreneuriat. Le ciblage restera imprécis — accepte-le.
- **Budget de départ :** **3 000 à 5 000 HTG/semaine**, pas plus, tant que le
  coût par contact WhatsApp n'est pas connu.
- **Format qui marche :** une **vidéo verticale de 30 secondes**, filmée dans ton
  kiosque, en créole, toi qui parles. Pas de motion design. La crédibilité vient
  du décor réel.
- **Objectif de campagne :** *Messages* (ouvrir une conversation WhatsApp) —
  **jamais** *Trafic* vers un site. La conversation est la conversion.
- **Seuil de décision :** si un contact WhatsApp coûte plus de **300 HTG**,
  coupe et retourne au terrain.

### 4. Le parrainage — *le levier qui compose*

À mettre en place dès le 10ᵉ client payant.

> **Un kiosque parrainé qui paie = 1 mois offert au parrain et au filleul.**

Simple, mémorisable, et ça s'aligne : le parrain a intérêt à ce que son filleul
utilise vraiment l'app, pas juste à ce qu'il s'inscrive. Un client qui parraine
2 kiosques par an divise ton coût d'acquisition par trois.

*(La skill `referral-program` est installée pour affiner les mécaniques.)*

### 5. ⭐ Les compagnies de camions d'eau — *le pari stratégique*

**C'est l'idée la plus importante de ce plan.**

Les compagnies qui livrent les camions **connaissent chaque kiosque du pays**.
Elles ont la liste de clients que tu mettrais trois ans à construire à pied.

Ce que tu peux leur proposer :
- **Pour elles :** des clients qui commandent au bon moment et ne tombent plus en
  rupture, donc qui commandent plus régulièrement. Et, si tu le construis, une
  vue agrégée et anonymisée de la demande.
- **Pour toi :** leur recommandation, ou une commission par kiosque abonné.

⚠️ **Ligne rouge à ne jamais franchir :** ne leur donne **jamais** accès aux
chiffres d'un kiosque sans l'accord explicite du propriétaire. Ton produit
existe pour dire à un commerçant s'il se fait avoir sur le prix du camion — s'il
soupçonne que tu travailles pour le camionneur, tu es mort. Écris cette limite
dans ton contrat et dis-la à tes clients avant qu'ils la demandent.

**À tester après les 50 premiers clients**, pas avant : sans preuve, tu n'as rien
à négocier.

---

## 6. Ce qu'il faut mesurer

**La métrique nord** — celle qui compte plus que le nombre d'inscrits :

> **Le nombre de kiosques qui ont saisi au moins 20 jours dans le mois.**

Un kiosque qui saisit 20 jours renouvellera. Un kiosque inscrit qui ne saisit pas
est déjà perdu — il ne le sait juste pas encore.

| Indicateur | Cible mois 3 | Cible mois 6 |
|---|---|---|
| Kiosques actifs (≥ 20 saisies/mois) | 20 | 80 |
| Kiosques payants | 15 | 60 |
| Activation (7 jours saisis dans les 14 premiers) | 50 % | 65 % |
| Conversion essai → payant | 30 % | 40 % |
| Perte mensuelle (churn) | < 10 % | < 5 % |
| Coût d'acquisition | < 1 500 HTG | < 1 000 HTG |
| Parrainages par client actif / an | — | 0,5 |

**Comment mesurer sans usine à gaz :** un tableur avec une ligne par kiosque
(nom, quartier, date d'essai, date de paiement, dernière saisie). Le champ
« dernière saisie » vient de Supabase. Rien de plus n'est nécessaire avant 200
clients.

---

## 7. Le calendrier — 4 phases sur 6 mois

### Phase 0 — Fabriquer la preuve · *semaines 1-2*

Rien ne se vend sans ça.

- [ ] Écrire **l'étude de cas de ton kiosque** : chiffres avant / après, et
      surtout **une décision concrète que l'app a permise** (« j'ai augmenté mon
      prix de 1 HTG au bon moment, +1 200 HTG le mois »).
- [ ] Filmer **une vidéo de 60 secondes** dans le kiosque, en créole.
- [ ] Préparer **le téléphone de démo** avec des données réelles et présentables.
- [ ] Décider et écrire les **conditions** : prix, essai, ce qui se passe si on
      ne paie pas, qui possède les données.
- [ ] **Produit :** implémenter la vérification d'abonnement (voir §3).

### Phase 1 — 10 pilotes gratuits · *semaines 3-6*

Objectif : **apprendre**, pas encaisser.

- [ ] Recruter **10 kiosques de ton réseau**, 3 mois gratuits en échange d'un
      retour honnête et d'un témoignage s'ils sont contents.
- [ ] **Installer avec chacun** et faire la première saisie ensemble.
- [ ] **Repasser à J+14** — c'est la visite qui décide de tout.
- [ ] Mener **10 entretiens** (utilise la skill `customer-interview-script`,
      méthode Mom Test) : demande ce qu'ils **font**, pas ce qu'ils **pensent**.
- [ ] **Noter le prix que chacun cite** spontanément.

**Critère de passage :** au moins **6 des 10 saisissent encore à la semaine 4**.
Si non — le problème est le produit ou l'usage, pas le marketing. **Arrête-toi et
corrige avant de dépenser un centime en publicité.**

### Phase 2 — Ouverture payante en grappes · *semaines 7-12*

- [ ] Fixer le prix définitif à partir des 10 réponses.
- [ ] **Convertir les pilotes** en payants (avec un tarif à vie préférentiel —
      ils ont pris le risque).
- [ ] Choisir **2 quartiers denses** et les saturer : 10 visites/jour, 3 jours par
      semaine.
- [ ] Lancer le **statut WhatsApp** régulier et le **groupe utilisateurs**.
- [ ] Publier la **page de vente** (skills `landing-page-generator` +
      `copywriting`).
- [ ] Ouvrir le **parrainage** au 10ᵉ payant.

**Objectif : 30 kiosques payants.**

### Phase 3 — Amplifier · *mois 4-6*

- [ ] Lancer la **pub Facebook** avec le discours désormais validé.
- [ ] Approcher **2 compagnies de camions** avec 50 clients en preuve.
- [ ] Publier **3 témoignages vidéo** de clients (pas toi — eux).
- [ ] Décider de la suite : **nouvelle ville**, **autre pays francophone**, ou
      **autre type de commerce** ?

**Objectif : 100 kiosques payants.**

---

## 8. Les objections que tu vas entendre

Prépare ces réponses avant la première visite.

| Objection | Réponse |
|---|---|
| **« Je n'ai pas besoin, je sais compter. »** | *« Vous savez ce que vous encaissez. Vous savez ce que vous gagnez sur un gallon aujourd'hui, après la dernière hausse ? »* Puis silence. |
| **« C'est trop cher. »** | *« 500 HTG, c'est ce que vous perdez en une semaine si le camion augmente et que vous ne l'ajustez pas. Essayez 30 jours gratuitement — si ça ne vous a rien rapporté, ne payez pas. »* |
| **« Je n'ai pas internet. »** | *« Justement. Elle marche sans. Vous saisissez, ça s'enregistre sur le téléphone. »* — C'est ton meilleur argument, ne le garde pas pour la fin. |
| **« Mes chiffres vont où ? »** | *« Sur votre téléphone. Rien ne part sans que vous l'activiez. Personne d'autre ne les voit — ni moi, ni la compagnie du camion. »* |
| **« J'essaierai plus tard. »** | *« On installe maintenant, ça prend 3 minutes, et on saisit votre journée d'hier ensemble. »* Ne pars jamais sur un « plus tard ». |
| **« Et si vous disparaissez ? »** | *« Vos données sont exportables quand vous voulez, et elles restent sur votre téléphone. Vous ne perdez rien. »* |

---

## 9. Les cinq risques, et quoi faire

| Risque | Ce que ça donne | Parade |
|---|---|---|
| **Abandon après 2 semaines** | Le vrai tueur. Il paie un mois, puis arrête de saisir. | Visite à J+14 systématique. Rappel WhatsApp les jours sans saisie. |
| **Le prix est trop haut** | Beaucoup d'essais, peu de conversions. | Le découvrir en phase 1, pas après la pub. Prévoir un palier à 300 HTG. |
| **Encaisser est pénible** | Tu passes ton temps à courir après 500 HTG. | Pousser l'annuel. Automatiser MonCash. Relance WhatsApp automatique. |
| **Un concurrent gratuit** | Quelqu'un copie et donne l'app. | Ton avantage n'est pas le code — c'est le terrain, la confiance et le réseau. Sature vite. |
| **Le marché haïtien plafonne** | 200 clients et plus rien. | C'est prévu. Le beachhead est une preuve, pas une destination (voir §4). |

---

## 10. Par où commencer, concrètement

Cette semaine, dans cet ordre :

1. **Sors les chiffres de ton kiosque** et écris l'étude de cas — une page, une
   décision concrète, un montant en gourdes.
2. **Fais la liste des kiosques que tu peux atteindre** — nom, quartier,
   téléphone, comment tu le connais. Vise 20 lignes.
3. **Filme la vidéo de 60 secondes** avec ton téléphone.
4. **Va voir 3 propriétaires** — sans rien vendre. Pose seulement la question du
   prix du camion et écoute. Tu sauras en une journée si ce plan tient.

> **Ne dépense pas un gourde en publicité avant l'étape 4.**

---

## Les skills à utiliser pour la suite

| Étape | Skill |
|---|---|
| Affiner le client idéal | `ideal-customer-profile` |
| Valider le prix | `pricing-strategy` |
| Entretiens de validation | `customer-interview-script` |
| Positionnement et argumentaires | `marketing-strategy-pmm` |
| Page de vente + textes | `landing-page-generator`, `copywriting` |
| Mécanique de parrainage | `referral-program` |
| Publicités et campagnes | `marketing` |
| Modèle économique sur 1 page | `lean-canvas` |
