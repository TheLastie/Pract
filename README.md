# Грибной атлас — лабораторная работа №3

**Русский** | [English](README.en.md)

Клиент-серверный каталог грибов. Браузер получает записи через REST API на FastAPI, а backend хранит их в SQLite с помощью SQLAlchemy.

## Сущность

Основная сущность — гриб (`Mushroom`), таблица `mushrooms`:

| Поле | Тип | Назначение |
|---|---|---|
| `id` | integer | Первичный ключ |
| `name` | string(100) | Русское название |
| `latin` | string(120), nullable | Латинское название |
| `family` | string(100) | Семейство |
| `season` | string(100) | Сезон |
| `category` | enum string | `edible`, `poisonous` или `unknown` |
| `description` | text | Описание |
| `illustration`, `photo` | string(500), nullable | Пути к изображениям проекта |
| `plate` | string(30), nullable | Подпись ботанической таблицы |
| `created_at` | datetime | Дата создания, задаётся сервером |

При первом запуске SQLite создаёт таблицу и загружает шесть демонстрационных записей. Файл базы находится в `backend/data/mushrooms.db` и исключён из Git.

## REST API

Все маршруты имеют префикс `/api`. FastAPI автоматически строит OpenAPI-спецификацию и документацию.

| Метод | Путь | Успешный ответ |
|---|---|---|
| GET | `/api/mushrooms` | `200` — список |
| POST | `/api/mushrooms` | `201` — созданная запись |
| GET | `/api/mushrooms/{id}` | `200` — запись |
| PATCH | `/api/mushrooms/{id}` | `200` — изменённая запись |
| DELETE | `/api/mushrooms/{id}` | `204` — удалена без тела |

`404` означает, что запись не найдена; `400` — пустой PATCH; `422` — поля не прошли проверку. Тело `POST` включает `name`, `family`, `season`, `category` и `description`; `latin` можно не передавать. Длина и категория проверяются и в Pydantic, и ограничениями таблицы.

Пример создания:

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

Изменение использует PATCH, например `{"description": "Новое описание гриба."}`. Запросы выполняются напрямую из JavaScript через `fetch`.

## Запуск

Нужен Python 3.10 или новее. Из корня проекта:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload
```

Откройте сайт на <http://127.0.0.1:8000>, Swagger UI — на <http://127.0.0.1:8000/docs>, ReDoc — на <http://127.0.0.1:8000/redoc>, JSON спецификации — на <http://127.0.0.1:8000/openapi.json>. Этот сервер также раздаёт CSS, JavaScript и изображения, поэтому для сайта не нужна отдельная настройка CORS.

По умолчанию используется SQLite. Для PostgreSQL задайте переменную окружения `DATABASE_URL`, например `postgresql+psycopg://user:password@localhost/mushrooms`, установите драйвер `psycopg` и укажите соответствующий URL перед запуском. Секреты и `.env` в Git не добавляются.

## Проверка API

Из корня проекта выполните:

```powershell
python -m unittest discover -s backend/tests -v
```

Проверяются CRUD, статусы `201/204/400/404/422`, схема OpenAPI и валидация путей изображений. Тесты используют отдельную базу SQLite в памяти.

## Структура

```text
backend/app/       FastAPI, SQLite, SQLAlchemy, схемы, CRUD и маршруты
backend/tests/     интеграционные проверки API
backend/data/      локальная SQLite база (создаётся автоматически)
index.html         frontend каталога
js/app.js          загрузка и CRUD через REST API
css/style.css      стили атласа
assets/images/     ботанические таблицы и фотографии
```

Скриншоты для сдачи можно получить после запуска backend: снимок Swagger — на `/docs`, сайта с данными сервера — на `/`, а строки таблицы `mushrooms` — запросом `SELECT * FROM mushrooms` в SQLite-клиенте.

Чтобы повторить проверки frontend в Edge, сначала запустите backend, затем:

```powershell
playwright-cli -s=lr3 open about:blank --browser=msedge
playwright-cli -s=lr3 --raw run-code --filename=tests/browser-check.js
playwright-cli -s=lr3 --raw run-code --filename=tests/capture-lr3.js
```

Три итоговых скриншота: [frontend](screenshot-lr3-frontend.png), [Swagger UI](screenshot-lr3-api.png), [записи из SQLite через API](screenshot-lr3-database.png).
