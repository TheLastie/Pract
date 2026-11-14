"""Нагрузочный тест: 40 потоков 60 секунд шлют запросы на http://localhost."""
import concurrent.futures as f
import time
import urllib.request

URL = "http://localhost"
SECONDS = 60
THREADS = 40

end = time.time() + SECONDS


def worker(_):
    count = 0
    while time.time() < end:
        urllib.request.urlopen(URL).read()
        count += 1
    return count


with f.ThreadPoolExecutor(THREADS) as pool:
    print("requests:", sum(pool.map(worker, range(THREADS))))
