# Cache Comparison Practice

Практика: сравнение трёх стратегий кеширования (Lazy Loading, Write-Through, Write-Back) с нагрузочным тестированием.

## Быстрый старт

### 1. Подняться в папку проекта
```bash
cd cache-comparison
```

### 2. Установить зависимости
```bash
npm install
cd load-generator && npm install && cd ..
```

### 3. Поднять Docker контейнеры
```bash
docker-compose up -d
```

### 4. Дождаться готовности PostgreSQL и инициализировать БД
```bash
# Дождитесь пока контейнер будет ready
docker ps

# Инициализируйте БД
docker exec cache-comparison-postgres-1 psql -U postgres -c "CREATE DATABASE cache_test;"
docker exec -i cache-comparison-postgres-1 psql -U postgres cache_test < scripts/init.sql
```

### 5. Запустить приложение
```bash
npm run start:dev
```

Приложение будет доступно на `http://localhost:3000`

### 6. Запустить тесты

**Один тест:**
```bash
cd load-generator
npx tsx index.ts --strategy lazy --mode read-heavy --duration 30 --concurrency 10
```

**Все 9 тестов:**
```bash
bash run-all-tests.sh
```

## Стратегии кеширования

### 1. Lazy Loading (Cache-Aside)
- Чтение: запрашивает из кеша, при промахе идёт в БД
- Запись: напрямую в БД, инвалидирует кеш

Эндпоинты:
- `GET /lazy/:id` — получить продукт
- `PUT /lazy/:id` — обновить продукт

### 2. Write-Through
- Чтение: из кеша
- Запись: одновременно в кеш И в БД

Эндпоинты:
- `GET /write-through/:id`
- `PUT /write-through/:id`

### 3. Write-Back
- Чтение: из кеша
- Запись: в кеш, асинхронный флеш в БД каждые 5 секунд

Эндпоинты:
- `GET /write-back/:id`
- `PUT /write-back/:id`
- `GET /write-back/flush` — ручной флеш

## Режимы нагрузки

- `read-heavy` — 80% чтение / 20% запись
- `balanced` — 50% чтение / 50% запись
- `write-heavy` — 20% чтение / 80% запись

## Метрики

Собираются автоматически:
- Throughput (req/sec)
- Среднюю задержку (avg, min, max, p95, p99)
- Cache hit rate (%)
- Количество обращений в БД

Получить метрики:
```bash
curl http://localhost:3000/metrics
curl http://localhost:3000/metrics?strategy=lazy
```

## Результаты тестирования

### Итоговые метрики (30s duration, concurrency 10)

#### Throughput (запросов/сек)

| Режим | Lazy Loading | Write-Through | Write-Back |
|-------|:------------:|:-------------:|:----------:|
| **Read-Heavy** | **6675** | 6144 | 3735 |
| **Balanced** | **5457** | 4204 | 4029 |
| **Write-Heavy** | **3783** | 3014 | **4301** |

#### Средняя задержка (ms)

| Режим | Lazy Loading | Write-Through | Write-Back |
|-------|:------------:|:-------------:|:----------:|
| **Read-Heavy** | **1.5** | 1.63 | 2.68 |
| **Balanced** | **1.83** | 2.38 | 2.48 |
| **Write-Heavy** | **2.64** | 3.32 | **2.32** |

#### Hit Rate кеша (%)

| Режим | Lazy Loading | Write-Through | Write-Back |
|-------|:------------:|:-------------:|:----------:|
| Read-Heavy | 79.44 | **99.44** | **99.09** |
| Balanced | 50.02 | **100.00** | **100.00** |
| Write-Heavy | 20.14 | **100.00** | **100.00** |

#### Обращений в БД

| Режим | Lazy Loading | Write-Through | Write-Back |
|-------|:------------:|:-------------:|:----------:|
| Read-Heavy | 73,172 | 37,488 | **6,256** |
| Balanced | 122,843 | 63,001 | **5,839** |
| Write-Heavy | 108,947 | 72,367 | **5,696** |

### Выводы

**Lazy Loading (Cache-Aside)**
- ✅ Лучший throughput при чтении (highest speed)
- ❌ Низкий hit rate при смешанной и write-heavy нагрузке
- ❌ Много обращений в БД

**Write-Through**
- ✅ Высокий hit rate (99-100%)
- ✅ Гарантированная консистентность
- ❌ Медленнее при write-heavy нагрузке
- ❌ Много обращений в БД при write-heavy

**Write-Back**
- ✅ **Минимум обращений в БД** (оптимизирует нагрузку)
- ✅ **Лучший throughput при write-heavy** (4301 req/s)
- ✅ 100% hit rate для balanced и write-heavy
- ❌ Риск потери данных при сбое

### Рекомендации

| Сценарий | Стратегия | Причина |
|----------|-----------|---------|
| **Читаем часто** | Lazy Loading | Максимальный throughput (6675 req/s) |
| **Критичные данные** | Write-Through | Гарантированная консистентность |
| **Много записей** | Write-Back | Минимум нагрузки на БД (5.7k writes vs 72k) |

---

Результаты сохраняются в папке `results/` в формате JSON.

## Очистка

```bash
docker-compose down
npm run clean  # или rm -rf dist node_modules load-generator/node_modules
```
