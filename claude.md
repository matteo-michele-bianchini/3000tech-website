# 3000tech-website

Landing page statica di **Impresa Artigiana Informatica di Matteo Michele Bianchini** (P.IVA 14501800966) — brand commerciale **3000tech**.

## Dev

```bash
npm run dev   # live-server su 0.0.0.0:3000, watch ricorsivo
```

Docker (WSL): `bash ops/start-dev-docker.sh` — builda/avvia container node, espone `3000:3000`, apre Chrome su `localhost:3000` appena il server risponde.

## Deploy

- **GitHub Pages** da branch `main`, path `/` — dominio `3000tech.it` (file `CNAME`), HTTPS enforced.
- Workflow: lavoro su `dev`, merge/push su `main` per pubblicare. Push su `dev` o branch feature **non** pubblica.

## Struttura

- `index.html` — versione italiana (lingua principale)
- `en/index.html` — versione inglese
- `css/styles.css` — CSS custom (override e componenti)
- `js/main.js` — interazioni (counter, orbita, ecc.)
- `images/logos/` — loghi clienti portfolio
- `images/team/` — foto team
- `images/preview/` — OG image
- `docs/` — presentazione commerciale
- `ops/start-dev-docker.sh` — launcher Docker dev (WSL-only)

Tailwind via CDN (`cdn.tailwindcss.com`) + Font Awesome CDN. Nessun build step.

## Contenuti

Ordine sezioni corrente: **Hero → Portfolio → Chi Siamo → Team → Servizi → Tech Stack → Contatti**.

- **Hero** riposizionato attorno a IT / R&D / AI / Business Automation (non più solo "full-stack dev"). Orbita multi-anello con chip brand-colored.
- **Team**: Matteo Bianchini (CEO / Software Engineer) + Giulia Onorato (Operations).
- **Portfolio**: Poste Italiane, Lavazza, Leroy Merlin, Generali, Zucchetti, Goglio, Arup, Mia-Platform, Beta 80, RTM Breda, Voidless, RareEarth, NewtonThrust, YunoAI, Nursy, 3DBusiness, 8853.
- **Contatti**: `matteo.michele.bianchini@gmail.com`, +39 378 0815788, Milano.
- P.IVA `14501800966` nel footer.

## Convenzioni

- Lingua di lavoro con l'utente: **italiano**.
- Mantenere `index.html` (IT) e `en/index.html` **allineati** a ogni modifica di contenuti/struttura.
- Palette/tono: moderno, professionale, accessibile. Tailwind utility-first; custom CSS solo quando serve.
- Commit brevi in inglese, prefisso `feat:` / `chore:` / `fix:` come nel log esistente.
