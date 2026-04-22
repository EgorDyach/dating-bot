# Отчёт: RabbitMQ vs Redis Streams

Сгенерировано автоматически из `results/*.json`. Добавьте скриншоты дашбордов и выводы вручную.

## Сводная таблица (consumer throughput msg/s / p95 / lost)

| Сценарий | Payload (B) | Цель msg/s | RabbitMQ | Redis |
| --- | --- | --- | --- | --- |
| smoke 2000 msg/s, 1KB | 1024 | 2000 | 1571 / p95 1190ms / lost 0 | 1193 / p95 1ms / lost 0 |
| smoke 500 msg/s, 128B | 128 | 500 | 477 / p95 6ms / lost 0 | 296 / p95 1ms / lost 0 |

## Что дописать в выводах (по заданию)

- Какой брокер показал большую пропускную способность на вашем железе.
- Какой брокер лучше переносит рост размера сообщения.
- При какой нагрузке single instance RabbitMQ и Redis начали деградировать (очередь, p95, ошибки).
- Какой инструмент нагрузочного теста удобнее для такого сценария и почему (здесь: кастомный Node producer/consumer).

## Методология

- Одинаковый JSON формат сообщения (`id`, `sentAtMs`, `padding`).
- Latency = время от `sentAtMs` до обработки consumer (end-to-end).
- `lost = max(0, sent - consumed)` после drain timeout.
- Деградация: рост backlog, высокий p95, доля ошибок (см. `.env.example`).