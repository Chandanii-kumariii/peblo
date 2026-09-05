# Peblo TV Mini

Peblo TV Mini is a full-stack content-management system and streaming catalogue viewer. Editors create shows, seasons, episodes, and artwork in the CMS; after validation, an admin publishes an immutable catalogue consumed by the viewer.

## Repository and demo

- Repository: add the public Git URL here before submitting.
- Screen recording: add a share link to the walkthrough here before submitting.
- CMS: `http://localhost:5173`
- Viewer: `http://localhost:5174`
- API documentation: `http://localhost:8000/docs`

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite for local development/tests, and PostgreSQL via Docker Compose.
- Frontend: React 19, Vite, TanStack Query, and Tailwind CSS.
- Media/catalogue storage: local filesystem behind a small storage-provider abstraction.
- Infrastructure: Docker Compose and a GitHub Actions workflow.

## How to run

### Option 1: Docker Compose

Prerequisites: Docker Desktop and Docker Compose.

```bash
docker compose up --build
```

The compose stack starts PostgreSQL, initializes the database, and runs the API, CMS, and viewer. Open the URLs listed above when the containers are healthy.

### Option 2: local development without Docker

Prerequisites: Python 3.11+ and Node.js 20+.

Open three terminals from the repository root.

```bash
# Terminal 1: API
cd api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
api\venv\Scripts\python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: CMS
cd cms
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

```bash
# Terminal 3: Viewer
cd viewer
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

The local API uses `api/peblo.db` and persists artwork plus the published catalogue in `api/uploads/`. The included seed data and generated catalogue allow the viewer to show content immediately.

### Tests

```bash
api\venv\Scripts\python -m pytest api\test_main.py -q
```

The backend tests cover database constraints, artwork validation, publish validation/atomicity, and admin-role enforcement.

## Typical flow

1. Open the CMS and create or edit a show, season, and episode.
2. Upload a poster, banner, and thumbnail for each episode.
3. Open **Publish Center** and resolve any validation findings.
4. Publish the catalogue as an admin.
5. Open the viewer, browse sections, search, and open a show detail page.

## Key decisions

### Atomic publishing

Publishing writes the complete catalogue to a temporary file and then replaces the active `catalog.json` with `os.replace()`. The viewer therefore sees either the previous valid catalogue or the new valid catalogue, never a partially written file.

### Storage abstraction

`StorageProvider` separates application logic from local storage. `LocalStorageProvider` is the current implementation; an object-storage provider (for example S3 or Cloudflare R2) can replace it without changing catalogue or upload logic. Artwork is served directly from the same storage location used by uploads, avoiding divergent write and read paths.

### Data integrity at the database layer

- Published shows must have a section.
- A content group may have only one episode per language.
- The publish validation report blocks incomplete metadata, missing durations, and missing artwork.

### Catalogue conventions

- Season `0` represents trailers and extras.
- Episodes with the same `content_group` are language variants of one asset. Publishing collapses them into one viewer item with a `languages` array.

### Local developer experience

The API accepts both `localhost` and `127.0.0.1` origins for the CMS and viewer. Frontend API URLs can be configured with `VITE_API_URL`; otherwise the viewer derives a local API URL from its current host.

### Search and published-catalogue trade-off

The viewer calls only `GET /catalog` and `GET /catalog/search`, never admin endpoints. Search is server-side, case-insensitive containment matching across show titles, episode titles, and categories; category, language, and section filters compose. Reading the published JSON is a good fit for this small catalogue and scales to thousands of titles, but repeatedly parsing a large (tens-of-megabytes) catalogue would become costly. At that point, publishing should also update a search index such as Meilisearch or OpenSearch.

The pre-published file makes the read-heavy viewer fast, cacheable, and independent of the transactional database. The cost is eventual consistency: edits are invisible until a publish succeeds, and personalization or partial updates need an additional service. If a process dies before the atomic rename, the previous complete catalogue remains live; only an unused temporary file may remain.

## Trade-offs and future work

- Authentication is intentionally lightweight for the exercise. Publishing accepts the CMS's mock `x-user-role: admin` header, and the API also supports JWT bearer tokens. Production should use a real identity provider, secret management, audit trails, and server-side roles.
- The project handles artwork and metadata, not video upload, transcoding, DRM, or playback. A production system would use resumable uploads, signed storage URLs, a transcoding pipeline, and a CDN.
- Docker runs Vite development servers to optimize reviewer feedback. A production deployment should build static assets and serve them behind a web server/CDN.
- SQLite is appropriate for local development and tests; PostgreSQL is included for the containerized stack. Production would add migrations, backups, observability, rate limiting, and structured logging.
- Seed artwork is deliberately simple placeholder imagery. A production catalogue needs reviewed editorial assets and accessibility metadata.
- I would alert on failed publish runs: they directly prevent approved editorial changes from reaching viewers and are actionable by the content/platform teams. The health endpoint can be used as a complementary availability check.

### AI assistance

OpenAI Codex was used to accelerate boilerplate, debugging, and test/build verification. Generated changes were reviewed against the supplied specification; in particular, the final implementation keeps server-side validation, atomic publishing, and the published-catalogue boundary rather than accepting client-only shortcuts.

## Approximate effort

These are estimated development times for the delivered scope; adjust them to reflect the final author's actual time before submission.

| Area | Approximate time |
| --- | ---: |
| Domain model, database constraints, and seed data | 1.5 hours |
| FastAPI endpoints, validation, publishing, and storage | 2.5 hours |
| CMS editing and publish workflow | 1.5 hours |
| Viewer, search, and show detail experience | 1.5 hours |
| Docker, CI, tests, debugging, and documentation | 1.5 hours |
| **Total** | **8.5 hours** |

## Recording checklist

For the requested screen recording, demonstrate this sequence:

1. Open the CMS dashboard and show the seeded catalogue.
2. Open Publish Center and publish successfully.
3. Open the viewer and show populated sections and artwork.
4. Search for a title or category.
5. Open a show detail page and switch between Season 1 and Trailers & Extras.
# peblo
