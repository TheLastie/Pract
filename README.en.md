# Mushroom Atlas — Lab Assignment 3

[Русский](README.md) | **English**

A client-server mushroom catalog. The browser reads and updates records through a FastAPI REST API; SQLAlchemy stores them in SQLite.

## Main entity

The primary entity is `Mushroom`, stored in the `mushrooms` table:

| Field | Type | Purpose |
|---|---|---|
| `id` | integer | Primary key |
| `name` | string(100) | Common name |
| `latin` | string(120), nullable | Latin name |
| `family` | string(100) | Family |
| `season` | string(100) | Growing season |
| `category` | enum string | `edible`, `poisonous`, or `unknown` |
| `description` | text | Description |
| `illustration`, `photo` | string(500), nullable | Paths to project images |
| `plate` | string(30), nullable | Botanical plate caption |
| `created_at` | datetime | Creation time, assigned by the server |

On first start, SQLite creates the table and inserts six sample entries. The database file is `backend/data/mushrooms.db` and is ignored by Git.

## REST API

All endpoints use the `/api` prefix. FastAPI generates the OpenAPI schema and interactive documentation.

| Method | Path | Success response |
|---|---|---|
| GET | `/api/mushrooms` | `200` — list |
| POST | `/api/mushrooms` | `201` — created record |
| GET | `/api/mushrooms/{id}` | `200` — record |
| PATCH | `/api/mushrooms/{id}` | `200` — updated record |
| DELETE | `/api/mushrooms/{id}` | `204` — deleted, no body |

`404` means the record does not exist, `400` is an empty PATCH body, and `422` means validation failed. POST requires `name`, `family`, `season`, `category`, and `description`; `latin` is optional. Pydantic and database constraints validate lengths and categories.

Example request:

```http
POST /api/mushrooms
Content-Type: application/json

{
  "name": "Лисичка обыкновенная",
  "latin": "Cantharellus cibarius",
  "family": "Лисичковые",
  "season": "июнь — ноябрь",
  "category": "edible",
  "description": "Ярко-жёлтая воронка с фруктовым запахом."
}
```

PATCH updates only supplied fields, for example `{"description": "Updated mushroom description."}`. The frontend calls the API with `fetch`.

## Run the app

Python 3.10 or newer is required. From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload
```

Open the site at <http://127.0.0.1:8000>, Swagger UI at <http://127.0.0.1:8000/docs>, ReDoc at <http://127.0.0.1:8000/redoc>, or the JSON schema at <http://127.0.0.1:8000/openapi.json>. FastAPI serves the frontend assets from the same origin, so no separate CORS setup is needed.

SQLite is used by default. To use PostgreSQL, set `DATABASE_URL`, for example `postgresql+psycopg://user:password@localhost/mushrooms`, install the `psycopg` driver, and provide the URL before starting the server. Keep secrets and `.env` files out of Git.

## Test the API

Run from the project root:

```powershell
python -m unittest discover -s backend/tests -v
```

The checks cover CRUD, `201/204/400/404/422` status codes, the OpenAPI schema, and image-path validation. They use a separate in-memory SQLite database.

## Project structure

```text
backend/app/       FastAPI, SQLite, SQLAlchemy, schemas, CRUD, and routes
backend/tests/     API integration tests
backend/data/      local SQLite database (created automatically)
index.html         catalog frontend
js/app.js          REST API loading and CRUD
css/style.css      atlas styles
assets/images/     botanical plates and photographs
```

For submission, run the backend and capture Swagger at `/docs`, the frontend with server-loaded data at `/`, and the `mushrooms` table in a SQLite client using `SELECT * FROM mushrooms`.

To repeat the browser checks in Edge, start the backend and run:

```powershell
playwright-cli -s=lr3 open about:blank --browser=msedge
playwright-cli -s=lr3 --raw run-code --filename=tests/browser-check.js
playwright-cli -s=lr3 --raw run-code --filename=tests/capture-lr3.js
```

The three screenshots are [the frontend](screenshot-lr3-frontend.png), [Swagger UI](screenshot-lr3-api.png), and [SQLite records returned by the API](screenshot-lr3-database.png).
