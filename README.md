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
- Export PDF de tous les tickets d'une année calendaire
- Export CSV filtré
- Conservation des données sur 4 ans + l'année en cours

## Prérequis

- Node.js ≥ 18 (mode développement)
- Compte MONEWEB actif

## Installation (avec Node.js)

```bash
git clone https://github.com/<votre-compte>/monewe.git
cd monewe
npm install
cp .env.example .env
# Éditez .env avec vos identifiants
```

## Mode standalone (sans Node.js requis)

Un binaire autonome intégrant le runtime Node.js peut être construit pour distribuer l'application sans installation préalable.

### Construire le binaire Mac ARM64 (Apple Silicon)

```bash
npm run build
# Crée dist/monewe-mac-arm64.zip
```

### Utiliser le binaire

1. Décompresser `monewe-mac-arm64.zip`
2. Copier `.env.example` → `.env` et y renseigner les identifiants
3. Double-cliquer sur `start.command` (ou `bash start.command`)
4. Ouvrir [http://localhost:3000](http://localhost:3000)

### Autres plateformes

| Plateforme | Construction |
|---|---|
| Mac x64 (Intel) | `X64_NODE=/path/node-x64 X64_SQLITE=/path/better_sqlite3-x64.node npm run build x64` |
| Windows x64 | Compiler sur Windows : `npm install && npm run build` |

> **Note** : le fichier `better_sqlite3.node` est lié à l'architecture et à la version de Node.js. Il doit être compilé sur la plateforme cible avec la même version ABI.

## Configuration

Créez un fichier `.env` à la racine (voir `.env.example`) :

```
MONEWEB_URL=https://<url-de-votre-portail>
MONEWEB_ID=<identifiant>
MONEWEB_PASSWORD=<mot-de-passe>
SYNC_HOUR=2
PORT=3000
```

## Utilisation

```bash
npm start
```

Accédez à l'interface sur [http://localhost:3000](http://localhost:3000).

> **Premier lancement** : cliquez sur « Synchroniser » pour récupérer vos tickets immédiatement.

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
