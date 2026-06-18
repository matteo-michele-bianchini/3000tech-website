# 3000tech-website

Landing page statica di **Impresa Artigiana Informatica di Matteo Michele Bianchini** (P.IVA 14501800966) — brand commerciale **3000tech**.

## Dev

```bash
npm run dev     # Eleventy --serve su :5173 (hot reload, builda in _site/)
npm run build   # build statico in _site/
npm test        # builda + test Playwright (orbita) contro _site/
```

Docker (WSL): `bash ops/start-dev-docker.sh` — builda/avvia container node, espone `5173:5173`, apre Chrome su `localhost:5173` appena il server risponde.

## Build & i18n (Eleventy)

Sito generato con **Eleventy** (SSG, template Nunjucks). Layout e logica sono centralizzati: i contenuti IT/EN vivono in file dati, **non** si duplica più l'HTML.

- I testi si modificano in `src/_data/it.json` / `src/_data/en.json` (più `site.json` per i dati strutturali condivisi: loghi, icone, colori, numeri).
- Il markup è in `src/_includes/base.njk` (head/nav/footer) + `src/_includes/sections/home.njk` (sezioni della home).
- Le pagine sono `src/index.njk` (IT, permalink `/`) e `src/en/index.njk` (EN, permalink `/en/`).
- Output buildato in `_site/` (gitignored). Tailwind via CDN (`cdn.tailwindcss.com`) + Font Awesome CDN; **non** c'è build di Tailwind.

## Deploy

- **GitHub Pages via GitHub Actions** (`.github/workflows/deploy.yml`): ogni push su `main` builda Eleventy e pubblica `_site/`. Dominio `3000tech.it` (`src/CNAME`), HTTPS enforced.
- Settings → Pages → Source deve essere **GitHub Actions** (non "Deploy from a branch").
- Workflow: lavoro su `dev` (o branch feature), merge/push su `main` per pubblicare. Push su `dev` o branch feature **non** pubblica.

## Struttura

- `src/index.njk` / `src/en/index.njk` — pagine IT/EN (sottili: includono `home.njk`)
- `src/_includes/base.njk` — layout (head, nav, footer, modale, script)
- `src/_includes/sections/home.njk` — sezioni della home
- `src/_data/{site,it,en}.json` — dati condivisi + dizionari i18n
- `src/css/styles.css` — CSS custom (override e componenti)
- `src/js/main.js` — interazioni (counter, orbita, ecc.)
- `src/images/{logos,team,preview}/` — loghi clienti, foto team, OG image
- `src/CNAME` — dominio custom
- `.eleventy.js` — config (input `src/`, output `_site/`, passthrough asset)
- `docs/` — presentazione commerciale (pubblicata via passthrough)
- `ops/start-dev-docker.sh` — launcher Docker dev (WSL-only)

## Contenuti

Ordine sezioni corrente: **Hero → Portfolio → Chi Siamo → Team → Servizi → Tech Stack → Contatti**.

- **Hero** riposizionato attorno a IT / R&D / AI / Business Automation (non più solo "full-stack dev"). Orbita multi-anello con chip brand-colored.
- **Team**: Matteo Bianchini (CEO / Software Engineer) + Giulia Onorato (Operations).
- **Portfolio**: Poste Italiane, Lavazza, Leroy Merlin, Generali, Zucchetti, Goglio, Arup, Mia-Platform, Beta 80, RTM Breda, Voidless, RareEarth, NewtonThrust, YunoAI, Nursy, 3DBusiness, 8853.
- **Contatti**: `matteo.michele.bianchini@gmail.com`, +39 378 0815788, Milano.
- P.IVA `14501800966` nel footer.

## Convenzioni

- Lingua di lavoro con l'utente: **italiano**.
- Contenuti multilingua: modificare **solo** i dizionari `src/_data/it.json` ed `en.json` (tenere le stesse chiavi in entrambi). Il markup è condiviso, niente più HTML duplicato da allineare.
- Palette/tono: moderno, professionale, accessibile. Tailwind utility-first; custom CSS solo quando serve.
- Commit brevi in inglese, prefisso `feat:` / `chore:` / `fix:` come nel log esistente.
