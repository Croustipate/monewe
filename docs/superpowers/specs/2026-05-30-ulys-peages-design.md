# ULYS Péages — Design Spec

**Date :** 2026-05-30  
**Projet :** monewe — extension péages Vinci ULYS

---

## Objectif

Ajouter un onglet "Péages" dans l'application monewe existante pour collecter, stocker et visualiser les passages de péage depuis le compte ULYS (Vinci Autoroutes) de l'utilisateur. L'expérience cible est identique à l'onglet Cantine : filtres de dates, résumé, liste, export CSV, synchro automatique quotidienne.

---

## Architecture

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `ulys-scraper.js` | Authentification OAuth2 PKCE + collecte des passages via API ULYS |
| `ulys-db.js` | Accès SQLite `ulys.db` — passages, tokens, sync_log |
| `ulys-scheduler.js` | Cron quotidien ULYS (découplé du scheduler cantine) |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `server.js` | Nouvelles routes `/api/ulys/*` + route `/ulys-callback` (OAuth2) |
| `public/index.html` | Deux onglets : Cantine / Péages |
| `public/app.js` | Logique onglets + chargement données ULYS |
| `public/style.css` | Styles onglets |
| `.env.example` | Variable `ULYS_SYNC_HOUR` |
| `bun-build.js` | Inchangé (ulys-scraper.js bundlé automatiquement) |

---

## 1. Authentification OAuth2 PKCE

### Flow (premier login)

1. L'utilisateur clique "Connecter ULYS" dans l'onglet Péages
2. Le serveur génère un `code_verifier` (64 octets random base64url) et `code_challenge` (SHA-256 du verifier, base64url)
3. Le serveur stocke `code_verifier` en mémoire (TTL 10 min)
4. Le frontend redirige le navigateur vers :
   ```
   https://connect.ulys.com/connect/authorize
     ?client_id=BCU.EspaceClient
     &redirect_uri=http://localhost:{PORT}/ulys-callback
     &response_type=code
     &scope=openid offline_access api.ulys.transac.r api.ulys.badges.r api.ulys.profile.r
     &code_challenge={code_challenge}
     &code_challenge_method=S256
   ```
5. L'utilisateur s'authentifie sur `connect.ulys.com` (login + MFA SMS si actif)
6. ULYS redirige vers `http://localhost:{PORT}/ulys-callback?code={code}`
7. Le serveur échange le code contre `access_token` + `refresh_token` :
   ```
   POST https://connect.ulys.com/connect/token
   grant_type=authorization_code
   code={code}
   redirect_uri=http://localhost:{PORT}/ulys-callback
   client_id=BCU.EspaceClient
   code_verifier={code_verifier}
   ```
8. Tokens stockés dans `ulys.db` table `ulys_tokens`

### Fallback si redirect_uri rejeté

L'UI affiche un champ "Coller le Bearer token" récupéré depuis les DevTools du navigateur (F12 → Network → Authorization header).

### Renouvellement automatique

- `access_token` : TTL ~1h, renouvelé via `refresh_token` avant chaque synchro
- `refresh_token` : TTL ~30 jours — si expiré, alerte UI "Reconnecter ULYS"
- Endpoint refresh : `POST https://connect.ulys.com/connect/token` avec `grant_type=refresh_token`

---

## 2. Stockage — `ulys.db`

```sql
CREATE TABLE IF NOT EXISTS passages (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,        -- ISO8601 ex: 2026-05-30T14:23:00
  amount     REAL NOT NULL,        -- négatif = débit
  location   TEXT,                 -- nom du péage
  autoroute  TEXT,                 -- ex: A7
  direction  TEXT,
  badge_id   TEXT,
  raw_json   TEXT,
  synced_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ulys_tokens (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TEXT               -- ISO8601
);

CREATE TABLE IF NOT EXISTS sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  status        TEXT,              -- 'success' | 'error'
  passages_new  INTEGER,
  error_msg     TEXT
);
```

Base séparée de `tickets.db`.

---

## 3. Collecte des passages (ulys-scraper.js)

Appels REST après authentification :

- **Badge :** `GET https://api.ulys.com/api/v1/badges` — badge télépéage actif
- **Transactions :** `GET https://api.ulys.com/api/v1/transactions?from={date}&to={date}`

Champs mappés :
- `id` ← identifiant unique du passage
- `date` ← horodatage ISO8601
- `amount` ← montant prélevé
- `location` ← nom du péage
- `autoroute` ← code autoroute (A7, A9…)
- `direction` ← sens de passage si disponible
- `badge_id` ← numéro de badge

> Les endpoints exacts seront confirmés/ajustés lors du développement via exploration réseau sur `account.ulys.com`.

Conservation : 4 ans glissants (même règle que la cantine).

---

## 4. Routes serveur

```
GET  /ulys-callback              OAuth2 callback — échange le code, stocke les tokens
GET  /api/ulys/auth/status       { connected, expires_at, badge_id }
GET  /api/ulys/auth/start        Redirige vers l'URL d'autorisation ULYS
POST /api/ulys/auth/token        Fallback : enregistre un Bearer token manuel
GET  /api/ulys/passages          { passages: [...] } — params: from, to
GET  /api/ulys/summary           { count, total, badge_id }
GET  /api/ulys/sync/status       { last_sync, in_progress }
POST /api/ulys/sync/trigger      Déclenche une synchro manuelle
GET  /api/ulys/export/csv        Export CSV filtré
```

---

## 5. UI — Onglets

### Structure

```
<nav class="tabs">
  <button class="tab active" data-tab="cantine">Cantine</button>
  <button class="tab" data-tab="peages">Péages</button>
</nav>
<div id="tab-cantine">  <!-- contenu existant inchangé -->  </div>
<div id="tab-peages" hidden>  <!-- nouveau -->  </div>
```

### Onglet Péages

- **Statut connexion :** "Connecté — expire le JJ/MM/AAAA" ou bouton "Connecter ULYS"
- **Résumé :** nombre de passages, total dépensé, badge actif
- **Filtres :** Mois en cours / Mois précédent / 3 mois / Cette année (avec navigation ‹ YYYY ›)
- **Liste :** date, lieu, autoroute, montant
- **Export CSV**
- **Synchro :** bouton manuel + statut dernière synchro (✓/✗ + message d'erreur)

---

## 6. Variables d'environnement

Aucune variable ULYS requise (tokens en DB). Optionnel dans `.env` :

```
ULYS_SYNC_HOUR=3    # Heure synchro auto péages (défaut 3h, 1h après cantine)
```

---

## 7. Gestion d'erreurs

| Erreur | Comportement |
|---|---|
| `redirect_uri` rejeté par ULYS | Fallback champ Bearer token manuel |
| `access_token` expiré | Refresh silencieux avant synchro |
| `refresh_token` expiré | Alerte UI "Reconnecter ULYS", synchro auto suspendue |
| API ULYS indisponible | Erreur loguée, données existantes affichées |

---

## 8. Hors scope

- Détail HTML de chaque passage
- Export PDF
- Multi-compte ULYS
- Notifications push
