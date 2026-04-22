# Сравнение RabbitMQ и Redis Streams (Node.js + TypeScript)

Стенд из трёх ролей: **producer** → **брокер** (RabbitMQ или Redis Streams) → **consumer**, плюс оркестратор бенчмарков и генерация отчёта.

## Требования

- Node.js 20+
- Docker / Docker Compose

## Быстрый старт

```bash
cd comparing-rabbit-and-redis
cp .env.example .env
npm install
npm run up
```

Подождите, пока RabbitMQ и Redis поднимутся (bench сам ждёт до `BROKER_WAIT_TIMEOUT_MS`). Если видите `ECONNREFUSED` / `ECONNRESET`, чаще всего контейнеры ещё не слушают порты — проверьте `docker compose ps`.

Дымовой прогон (2 сценария × 2 брокера):

```bash
npm run bench:smoke
npm run report
```

Обычный запуск теперь использует уменьшенную матрицу (2 интенсивности × 3 размера × 2 брокера = 12 прогонов):

```bash
npm run bench
npm run report
```

Полная матрица из задания (3 интенсивности × 4 размера × 2 брокера = 24 прогона):

```bash
npm run bench:full
npm run report
```

Результаты: `results/*.json`, сводка `results/summary.csv`, черновик отчёта `REPORT.md`.

## Переменные окружения

См. [`.env.example`](./.env.example). Основные:

| Переменная | Назначение |
|------------|------------|
| `BENCH_DURATION_SEC` | Длительность фазы publish (сек) |
| `BENCH_PRODUCERS` / `BENCH_CONSUMERS` | Число параллельных продюсеров / консьюмеров |
| `BENCH_SMOKE=1` | Короткая матрица для проверки |
| `DRAIN_TIMEOUT_SEC` | Ожидание опустошения очереди после publish |
| `DEGRADE_*` | Пороги эвристик деградации |

## Ручной режим (отдельные процессы)

Терминал 1 — публикация:

```bash
npm run producer -- redis 2000 15 1024
```

Терминал 2 — чтение (без `reset`):

```bash
npm run consumer -- redis 15 1
```

Аналогично замените `redis` на `rabbitmq`.

## Метрики

- **throughput** — фактические `messagesSent` / `messagesConsumed` на wall-clock всего прогона (включая drain).
- **latency** — end-to-end, `Date.now() - message.sentAtMs` в consumer.
- **lost** — `max(0, sent - consumed)` после drain.
- **degraded** — эвристики: рост backlog, высокий p95, доля ошибок.

## Остановка брокеров

```bash
npm run down
```
