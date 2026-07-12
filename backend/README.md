# Backend

FastAPI service backing the flashcards app: the existing Boolean-algebra
tasks API, plus persistent storage for flashcard sets (PostgreSQL for
metadata/cards, MinIO for embedded images).

## Local setup

1. Start Postgres + MinIO (from the repo root):

   ```bash
   docker compose up -d
   ```

   MinIO console is at http://localhost:9001 (login `flashcards` /
   `flashcards123`).

2. Create a venv and install dependencies:

   ```bash
   cd backend
   python3 -m venv .venv
   ./.venv/bin/pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` if you need to override any connection
   settings (defaults already match `docker-compose.yml`).

4. Apply database migrations:

   ```bash
   ./.venv/bin/alembic upgrade head
   ```

5. Run the API:

   ```bash
   ./.venv/bin/uvicorn backend.main:app --reload --app-dir ..
   ```

   (or `cd ..` and run `uvicorn backend.main:app --reload` from the repo
   root, as the frontend's Tasks view error message suggests).

## Sets API

- `GET /api/sets` — list stored sets (id, slug, label, category, card count).
- `GET /api/sets/{id}` — a set's full card list. Card `frontImage`/
  `backImage` are `/api/images/{key}` paths when the card had an embedded
  image, `null` otherwise.
- `POST /api/sets` — multipart form: `file` (a flashcard-set JSON file, same
  shape the frontend already accepts — `front`/`question`, `back`/`answer`,
  `frontImage`/`image`, `backImage`, `symbols`, `matching`), `label`, optional
  `category`. Any embedded base64 image data is decoded and stored as an
  object in MinIO; the card keeps a reference instead of the raw bytes.
  External image URLs/paths are left unstored (not embedded data, so there's
  nothing to extract).
- `DELETE /api/sets/{id}` — removes the set (cards cascade) and its images.
- `GET /api/images/{key}` — streams an image object out of MinIO.

## Schema migrations

Models live in `models.py`. After changing them, generate a migration:

```bash
./.venv/bin/alembic revision --autogenerate -m "describe the change"
./.venv/bin/alembic upgrade head
```
