# Запуск в Docker, логи в Grafana и CI/CD

Весь проект запускается через `docker compose`: три контейнера приложения и два для логов.

| Контейнер | Что делает | Адрес |
|---|---|---|
| `front` | nginx: отдаёт сайт, пересылает `/api` и `/docs` в `api`, пропускает фото до 6 МБ | http://localhost:8080 |
| `api` | FastAPI, база SQLite в томе `mushrooms-data` | через `front` (внутри `api:8000`) |
| `worker` | раз в минуту проверяет всю базу пачками по 500 строк (ссылки на фото без файла) и пишет итог в лог | внутри `worker:5000` |
| `loki` | хранит логи 7 дней | `127.0.0.1:3100` |
| `grafana` | просмотр логов | http://localhost:3000 (логин `admin`, пароль `admin`) |

Healthcheck (`GET /healthcheck` → 200) настроен у `api`, `worker` и `front`. `worker` отвечает 503, если проверка базы не удавалась больше трёх интервалов подряд.

## Файлы инфраструктуры

```text
docker-compose.yml                          все контейнеры, healthcheck, логирование
backend/Dockerfile                          образ для api и worker (команды разные)
backend/app/worker.py                       код воркера
front/Dockerfile, front/nginx.conf          образ и настройка front
loki/config.yaml                            настройка Loki
grafana/provisioning/datasources/loki.yaml  Loki подключается к Grafana автоматически
.gitlab-ci.yml                              CI/CD pipeline
.dockerignore                               что не попадает в образы
```

## Часть 1. Локальный запуск

Нужен Docker с Compose v2 (команда `docker compose`). Из корня проекта:

```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
docker compose up -d --build
docker compose ps
```

Первая команда нужна один раз: это Docker-плагин, который отправляет логи контейнеров в Loki вместо promtail. Если её пропустить, Docker ответит, что драйвер `loki` не найден.

`docker compose ps` должен показать `healthy` у `front`, `api` и `worker`. Затем:

- сайт — http://localhost:8080, Swagger — http://localhost:8080/docs;
- логи — http://localhost:3000 → меню **Explore** → источник **Loki** → запрос `{compose_service="worker"}` (или `api`, `front`) → **Run query**.

Остановка: `docker compose down` (данные сохраняются в томах). Полный сброс вместе с данными: `docker compose down -v`.

Пароль Grafana можно сменить: `GRAFANA_PASSWORD=секрет docker compose up -d`.

## Часть 2. ВМ и CI/CD в GitLab

Эти шаги выполняются вручную: создать ВМ и зарегистрировать runner можно только на вашей стороне.

### 1. Репозиторий в GitLab

Создайте проект в GitLab (или сделайте fork заданного) и отправьте туда этот код:

```bash
git remote add gitlab https://gitlab.com/<вы>/<проект>.git
git push gitlab main
```

### 2. Виртуальная машина

Создайте ВМ с Ubuntu 22.04 или 24.04 (облако или VirtualBox/Hyper-V с сетевым адаптером «мост»). Откройте порты 8080 и 3000.

### 3. Docker и runner на ВМ

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt install -y curl
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash
sudo apt install -y gitlab-runner
sudo usermod -aG docker gitlab-runner
```

Последняя команда даёт runner право запускать Docker.

### 4. Регистрация runner

В GitLab: **Settings → CI/CD → Runners**:

1. Снимите галочку **Enable instance runners for this project**.
2. Нажмите **New project runner**, отметьте **Run untagged jobs**, создайте runner.
3. GitLab покажет команду `gitlab-runner register --url ... --token ...`. Выполните её на ВМ через `sudo`, executor — **shell**.
4. Проверьте: `sudo gitlab-runner status` (служба запущена), в GitLab у runner зелёный кружок.

### 5. Запуск pipeline

Любой коммит в главную ветку запускает `.gitlab-ci.yml`:

| Этап | Что происходит |
|---|---|
| `build` | `docker compose config --quiet` проверяет файл, `docker compose build` собирает образы `front` и `backend` (для `api` и `worker`) |
| `deploy` | ставит плагин `loki`, если его ещё нет; `docker compose up -d --wait` запускает всё и ждёт `healthy`; затем `curl` проверяет сайт и `/api/mushrooms` |

После успешного pipeline сайт доступен на `http://<IP ВМ>:8080`, логи — на `http://<IP ВМ>:3000`. База хранится в томе и не теряется при новых деплоях.

## Если что-то не работает

- `plugin "loki" not found` или `error looking up logging plugin` — не установлен плагин, выполните команду `docker plugin install ...` из части 1.
- `permission denied ... docker.sock` в pipeline — runner не в группе `docker`: `sudo usermod -aG docker gitlab-runner` и `sudo systemctl restart gitlab-runner`.
- Pipeline «зависла в pending» — нет доступного runner: проверьте, что включён **Run untagged jobs** и runner онлайн.
- В Grafana нет логов — подождите 10–20 секунд и проверьте, что `loki` запущен (`docker compose ps`).
- Логи в Grafana есть, но нет вывода `docker compose logs` — это ограничение старых версий Docker (до 20.10) с плагином loki.

## Ограничения

- База — SQLite в одном файле, поэтому `api` запущен одним процессом. Для большой нагрузки её нужно заменить на PostgreSQL (в проекте это делается через `DATABASE_URL`).
- Конфигурация проверена на корректность YAML и работу кода воркера и `/healthcheck` на обычном Python. Сами контейнеры на машине, где это писалось, не запускались (там не установлен Docker), поэтому при первом запуске обратите внимание на вывод `docker compose ps`.
