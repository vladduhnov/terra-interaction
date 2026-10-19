# Terra Interaction

A Geolava property-intelligence prototype with a satellite map and resizable workspace.

**Live site:** [vladduhnov.github.io/terra-interaction](https://vladduhnov.github.io/terra-interaction/)

## Run locally

No package installation or build framework is needed. Copy `config.example.js` to `config.js` and replace the placeholder with a browser-public Mapbox token (`pk.…`). The local config is ignored by Git. From this directory:

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000/).

## Explore

- First-time sign-in, animated map scan, and address search. Use any made-up email and password; sign-in is a local prototype and credentials are never sent or saved. Skip opens Home.
- Property assessments for roof, sidewalks, roads, drainage, and greenery, with scores, confidence, suggestions, map regions, and right-click assistant chats.
- Monitoring cards and a City portfolio group of 100 mock buildings, with search, condition filters, numbered pagination, and matching map markers.
- Property conversations, five-year projections, satellite reveal slider, and an interactive event timeline.
- Sidebar History, avatar logout, and adjustable panel layouts.

Use `/?onboarding=1` to replay onboarding. Sample addresses include **101 Market Street** and **580 Howard Street**, San Francisco.

## Deployment

Pushing to `main` automatically runs `.github/workflows/pages.yml`, stages the static files with `scripts/build_site.py`, and deploys to GitHub Pages. The workflow can also be run manually from Actions. No application server is required. The workflow reads the `MAPBOX_ACCESS_TOKEN` repository secret and generates `dist/config.js`; no token is committed. This must be a browser-public Mapbox token, since the browser needs it to load map imagery.

```sh
node --check workspace.js
MAPBOX_ACCESS_TOKEN=your_public_mapbox_token python3 scripts/build_site.py
```

`dist/` is generated and ignored by Git. All asset paths are relative, so the site works under the `/terra-interaction/` project path.

## Prototype boundaries

Assessment data, buildings, monitoring updates, AI replies, confidence scores, and forecasts are illustrative. There is no live LLM, real authentication, or monitoring service. Conversations and preferences are saved in the current browser's local storage.

The live map and roof imagery use Mapbox with a browser-public token supplied through runtime configuration. Mapbox GL JS, Turf, Lottie, and fonts load from their respective CDNs. See [WORKSPACE.md](WORKSPACE.md) for implementation notes and [INTERACTIONS.md](INTERACTIONS.md) for the original interaction reference.
