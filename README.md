# monewe

Application web locale pour visualiser et analyser les tickets de cantine depuis un compte MONEYWEB.

L'application officielle MONEYWEB limite l'affichage à une trentaine de tickets. monewe collecte et stocke tous les tickets localement pour permettre un suivi complet sur n'importe quelle période.

## Fonctionnalités

- Synchronisation automatique quotidienne (heure configurable)
- Synchronisation manuelle via l'interface web
- Filtres par période avec raccourcis (mois en cours, mois précédent, 3 mois, année)
- Résumé : nombre de passages, total dépensé, moyenne par repas, rechargements, solde actuel
- Détail de chaque ticket avec impression / export PDF
- Export PDF de tous les tickets d'une année calendaire
- Export CSV filtré
- Conservation des données sur 4 ans + l'année en cours
- Accessible via tunnel Cloudflare (optionnel)

## Prérequis

- Node.js ≥ 18
- Compte MONEYWEB actif

## Installation

```bash
git clone https://github.com/<votre-compte>/monewe.git
cd monewe
npm install
npx playwright install chromium
cp .env.example .env
# Éditez .env avec vos identifiants
```

## Configuration

Créez un fichier `.env` à la racine (voir `.env.example`) :

```
MONEYWEB_URL=https://<votre-etablissement>.moneweb.fr
MONEYWEB_ID=<identifiant>
MONEYWEB_PASSWORD=<mot-de-passe>
SYNC_HOUR=2
PORT=3000
```

## Utilisation

```bash
npm start
```

Accédez à l'interface sur [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

## Architecture

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur Express — routes API et fichiers statiques |
| `db.js` | Accès SQLite — tickets, résumés, logs de synchro |
| `scraper.js` | Authentification Playwright + collecte via API MONEYWEB |
| `scheduler.js` | Cron quotidien et mutex de synchro |
| `public/` | Interface web (HTML + CSS + JS vanilla) |
| `test/` | Tests unitaires (Node.js test runner natif) |

## Variables d'environnement

| Variable | Description | Défaut |
|---|---|---|
| `MONEYWEB_URL` | URL de base de votre portail MONEYWEB | — |
| `MONEYWEB_ID` | Identifiant de connexion | — |
| `MONEYWEB_PASSWORD` | Mot de passe | — |
| `SYNC_HOUR` | Heure de synchro automatique (0–23) | `2` |
| `PORT` | Port du serveur web | `3000` |

## Licence

MIT
