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

### Docker, логи и CI/CD

Запуск в Docker (front, api, worker, Loki, Grafana) и настройка GitLab CI/CD описаны в [DEPLOY.md](DEPLOY.md). Коротко:

```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
docker compose up -d --build
```

Сайт — <http://localhost:8080>, логи в Grafana — <http://localhost:3000>.

## Отчёт по заданию DevOps (Docker, Loki + Grafana, GitLab CI/CD)

Задание: поднять проект через `docker compose` с контейнерами `front`, `api`, `worker`, настроить healthcheck, собирать логи в Loki + Grafana через Docker-плагин (вместо promtail) и сделать CI/CD pipeline для GitLab с запуском на ВМ.

### Что сделано

| Требование | Реализация |
|---|---|
| Контейнеры front, api, worker | `docker-compose.yml`; `front` — nginx со статикой и прокси `/api`, `api` — FastAPI, `worker` — `backend/app/worker.py` (тот же образ `backend/Dockerfile`) |
| Healthcheck api и worker (`GET /healthcheck` = 200) | маршрут `/healthcheck` в `backend/app/main.py` и мини-сервер в воркере на порту 5000; проверки описаны в `docker-compose.yml` |
| Логи через Loki и Grafana, promtail заменён плагином Docker driver | `logging: driver: loki` у контейнеров приложения, `loki/config.yaml`, источник данных Grafana в `grafana/provisioning/` |
| Вся инфраструктура в репозитории | `docker-compose.yml`, три Dockerfile/конфига, `loki/`, `grafana/`, `.gitlab-ci.yml`, `.dockerignore` |
| Документация по запуску | [DEPLOY.md](DEPLOY.md) |
| CI/CD: сборка и запуск на ВМ с логированием | `.gitlab-ci.yml`: этап `build` (`docker compose build`) и этап `deploy` (плагин loki, `docker compose up -d --wait`, проверка `curl`) |

Воркер раз в минуту обходит таблицу грибов пачками по 500 строк и ищет записи, у которых есть ссылка на загруженное фото, а файла в базе нет. Итог пишется в лог, его видно в Grafana.

### Что проверено

Docker на машине, где выполнялась работа, не установлен, поэтому **контейнеры не запускались, ВМ и GitLab runner не создавались**. Проверено вне Docker, тем же кодом, что попадёт в образы:

- сервер FastAPI запущен командой `python -m uvicorn backend.app.main:app`, сайт и Swagger открываются;
- `GET /healthcheck` у API и воркера возвращает 200;
- воркер работает и пишет в лог результат проверки базы;
- файлы `docker-compose.yml`, `.gitlab-ci.yml`, `loki/config.yaml` и конфиг Grafana читаются как корректный YAML; тесты API (`python -m unittest discover -s backend/tests`) проходят.

Не проверены: сборка образов, nginx-прокси, запись логов в Loki, pipeline в GitLab. Эти шаги выполняются по [DEPLOY.md](DEPLOY.md).

### Скриншоты

Сайт, запущенный локально без Docker, с данными из API:

![Сайт](screenshots/devops-site.png)

Swagger UI:

![Swagger](screenshots/devops-swagger.png)

Healthcheck API и воркера и лог воркера (текст собран из реального вывода команд):

![Healthcheck и лог воркера](screenshots/devops-worker-health.png)

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
