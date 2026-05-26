# monewe

Application web locale pour visualiser et analyser les tickets de cantine depuis un compte MONEWEB.

L'application officielle MONEWEB limite l'affichage à une trentaine de tickets. monewe collecte et stocke tous les tickets localement pour permettre un suivi complet sur n'importe quelle période.

## Fonctionnalités

- Synchronisation automatique quotidienne (heure configurable)
- Synchronisation manuelle via l'interface web
- Filtres par période avec raccourcis (mois en cours, mois précédent, 3 mois, année)
- Navigation par année (flèches ‹ / ›)
- Résumé : nombre de passages, total dépensé, moyenne par repas, rechargements, solde actuel
- Détail de chaque ticket avec impression / export PDF
- Export PDF de tous les tickets d'une année calendaire (mise en page 2 colonnes)
- Export CSV filtré
- Cache local des tickets pour le PDF hors-ligne
- Conservation des données sur 4 ans + l'année en cours

## Configuration

Créez un fichier `.env` à la racine (voir `.env.example`) :

```
MONEWEB_URL=https://<url-de-votre-portail>
MONEWEB_ID=<identifiant>
MONEWEB_PASSWORD=<mot-de-passe>
SYNC_HOUR=2
PORT=3000
```

---

## Option A — Mode développement (avec Node.js)

**Prérequis :** Node.js ≥ 18

```bash
git clone https://github.com/Croustipate/monewe.git
cd monewe
npm install
cp .env.example .env
# Éditez .env avec vos identifiants
npm start
```

Accédez à l'interface sur [http://localhost:3000](http://localhost:3000).

---

## Option B — Distribution autonome (sans installation requise)

Un binaire autonome intègre le runtime Node.js. L'utilisateur final décompresse une archive et double-clique sur le lanceur.

### Mac ARM64 (Apple Silicon M1/M2/M3/M4)

**Sur la machine de build (Mac Apple Silicon) :**

```bash
npm install
bash build.sh arm64
# Crée dist/monewe-mac-arm64.zip
```

**Déploiement :**

1. Décompresser `monewe-mac-arm64.zip`
2. Copier `.env.example` → `.env` et renseigner les identifiants
3. Double-cliquer sur `start.command` (ou `bash start.command`)
4. Ouvrir [http://localhost:3000](http://localhost:3000)

> macOS peut bloquer l'exécution au premier lancement. Aller dans **Réglages système → Confidentialité et sécurité** et autoriser l'application.

---

### Mac x64 (Intel)

**Sur la machine de build (Mac Apple Silicon avec Rosetta 2 installé) :**

```bash
npm install
bash build.sh x64
# Recompile better-sqlite3 pour x86_64 via Rosetta, puis crée dist/monewe-mac-x64.zip
```

Si la recompilation Rosetta échoue, compiler directement sur un Mac Intel :

```bash
# Sur Mac Intel :
npm install
bash build.sh arm64   # produit un binaire x64 natif
```

**Déploiement :** identique à ARM64, utiliser `start.command`.

---

### Windows x64

**Prérequis sur la machine Windows :**

- [Node.js LTS](https://nodejs.org/) (inclut npm)
- [Python 3](https://www.python.org/) (requis par node-gyp pour compiler better-sqlite3)
- Build Tools C++ : `npm install -g node-gyp` puis [Visual Studio Build Tools](https://visualstudio.microsoft.com/fr/visual-cpp-build-tools/)

```bat
git clone https://github.com/Croustipate/monewe.git
cd monewe
npm install
build.bat
:: Crée dist\monewe-windows-x64.zip
```

**Déploiement :**

1. Décompresser `monewe-windows-x64.zip`
2. Copier `.env.example` → `.env` et renseigner les identifiants
3. Double-cliquer sur `start.bat`
4. Ouvrir [http://localhost:3000](http://localhost:3000)

> **Note :** le fichier `better_sqlite3.node` est lié à la plateforme et à la version Node.js. La compilation doit se faire sur la même plateforme que la cible.

---

## Tests

```bash
npm test
```

## Architecture

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur Express — routes API et fichiers statiques |
| `db.js` | Accès SQLite — tickets, résumés, logs de synchro |
| `scraper.js` | Authentification HTTP + collecte via API MONEWEB |
| `scheduler.js` | Cron quotidien et mutex de synchro |
| `public/` | Interface web (HTML + CSS + JS vanilla) |
| `test/` | Tests unitaires (Node.js test runner natif) |
| `build.sh` | Script de build Mac (arm64 / x64) |
| `build.bat` | Script de build Windows x64 |

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `MONEWEB_URL` | URL de base de votre portail MONEWEB | — |
| `MONEWEB_ID` | Identifiant de connexion | — |
| `MONEWEB_PASSWORD` | Mot de passe | — |
| `SYNC_HOUR` | Heure de synchro automatique (0–23) | `2` |
| `PORT` | Port du serveur web | `3000` |

## Licence

MIT
