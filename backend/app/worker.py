"""Фоновый воркер: проверяет базу грибов и отвечает на GET /healthcheck.

Раз в WORKER_INTERVAL секунд он обходит таблицу mushrooms пачками по BATCH_SIZE строк
(так работает и с очень большой базой), не загружая сами фотографии в память.
Для каждого гриба проверяет, что у ссылки на фото есть загруженный файл,
и пишет итог в лог — его видно в Grafana (Loki).

Запуск: python -m backend.app.worker
"""

import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from sqlalchemy import select

from .database import SessionLocal
from .models import Mushroom

INTERVAL = int(os.getenv("WORKER_INTERVAL", "60"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "500"))
PORT = int(os.getenv("WORKER_PORT", "5000"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s worker: %(message)s")
log = logging.getLogger("worker")

last_success = time.time()  # время последнего удачного прохода по базе


def check_database() -> None:
    """Один проход по всей таблице пачками."""
    total = with_photos = 0
    broken: list[tuple[int, int]] = []  # (id гриба, номер слота фото)
    last_id = 0
    while True:
        with SessionLocal() as db:
            rows = db.execute(
                select(
                    Mushroom.id,
                    Mushroom.photo,
                    Mushroom.photo_data.is_not(None),
                    Mushroom.photo2,
                    Mushroom.photo_data_2.is_not(None),
                )
                .where(Mushroom.id > last_id)
                .order_by(Mushroom.id)
                .limit(BATCH_SIZE)
            ).all()
        if not rows:
            break
        for mushroom_id, photo, has_data, photo2, has_data_2 in rows:
            total += 1
            for slot, link, has_file in ((1, photo, has_data), (2, photo2, has_data_2)):
                if link and has_file:
                    with_photos += 1
                elif link and link.startswith("/api/"):
                    broken.append((mushroom_id, slot))  # ссылка есть, а файла в базе нет
        last_id = rows[-1][0]
    log.info("Проверено грибов: %d, фотографий: %d, битых ссылок на фото: %d", total, with_photos, len(broken))
    for mushroom_id, slot in broken:
        log.warning("У гриба %d нет файла для фото %d", mushroom_id, slot)


class Health(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        healthy = self.path == "/healthcheck" and time.time() - last_success < INTERVAL * 3
        self.send_response(200 if healthy else 503 if self.path == "/healthcheck" else 404)
        self.end_headers()
        self.wfile.write(b"ok" if healthy else b"fail")

    def log_message(self, *args) -> None:  # не засоряем лог запросами healthcheck
        pass


def main() -> None:
    global last_success
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Health)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log.info("Воркер запущен, проверка базы каждые %d с, healthcheck на порту %d", INTERVAL, PORT)
    while True:
        try:
            check_database()
            last_success = time.time()
        except Exception:
            log.exception("Не удалось проверить базу")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
