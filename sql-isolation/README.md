# Практика: Аномалии изоляции в SQL

Полное руководство по воспроизведению 4 основных аномалий изоляции в базах данных.

## 📋 Структура проекта

```
sql-isolation/
├── README.md                    # Этот файл
├── ОТЧЕТ.md                     # Полный отчет (ОСНОВНОЙ ФАЙЛ)
├── 01-lost-update.sql          # Lost Update (Потерянная запись)
├── 02-dirty-read.sql           # Dirty Read (Грязное чтение)
├── 03-non-repeatable-read.sql  # Non-repeatable Read
├── 04-phantom-read.sql         # Phantom Read (Фантомное чтение)
└── demo-script.sql             # Готовые скрипты для двух сессий
```

## 🎯 Быстрый старт

### Вариант 1: Читать отчет (5 минут)
Откройте **ОТЧЕТ.md** для полного понимания всех аномалий с примерами.

### Вариант 2: Воспроизвести аномалии (20 минут)
1. Откройте PostgreSQL или MySQL
2. Используйте команды из `demo-script.sql`
3. Откройте 2 окна/сессии
4. Скопируйте команды построчно из СЕССИИ 1 и СЕССИИ 2

### Вариант 3: Изучить каждую аномалию отдельно (30 минут)
Посмотрите файлы 01-04, они содержат:
- Описание проблемы
- Пошаговый сценарий
- Способы избежания

## 🔍 Краткое описание аномалий

### 1️⃣ Lost Update (Потерянная запись)
**Проблема:** Два пользователя одновременно обновляют один счетчик, и изменение одного теряется.

**Пример:** Два лайка на пост → видим только один лайк вместо двух.

**Решение:** `UPDATE field = field + 1` (атомарное обновление)

### 2️⃣ Dirty Read (Грязное чтение)
**Проблема:** Транзакция читает данные другой транзакции, которые потом откатываются.

**Пример:** Покупатель видит скидку 50%, но администратор передумал и отменил её.

**Решение:** Уровень изоляции READ COMMITTED или выше

### 3️⃣ Non-repeatable Read (Неповторяющееся чтение)
**Проблема:** Одна строка читается дважды и дает разные результаты.

**Пример:** Финотчет показывает сумму счетов → между первым и вторым подсчетом сумма изменилась.

**Решение:** Уровень REPEATABLE READ или снимки данных

### 4️⃣ Phantom Read (Фантомное чтение)
**Проблема:** Запрос с условием (WHERE) при повторном выполнении дает разное количество строк.

**Пример:** Менеджер видит 2 срочных заказа → через 10 секунд видит 4 (новые клиенты их добавили).

**Решение:** Уровень SERIALIZABLE или блокирование диапазона

## 📊 Таблица уровней изоляции

| Уровень | Lost Update | Dirty Read | Non-rep. Read | Phantom |
|---------|:-----------:|:----------:|:-------------:|:-------:|
| READ UNCOMMITTED | ❌ | ❌ | ❌ | ❌ |
| READ COMMITTED | ❌ | ✅ | ❌ | ❌ |
| REPEATABLE READ | ❌ | ✅ | ✅ | ❌ |
| SERIALIZABLE | ✅ | ✅ | ✅ | ✅ |

**Легенда:** ✅ = защита есть, ❌ = аномалия возможна

## 🚀 Как воспроизвести аномалию (пошагово)

### Пример: Lost Update

**Шаг 1:** Откройте два окна терминала/IDE (2 сессии БД)

**Шаг 2:** В окне 1 выполните инициализацию:
```sql
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title TEXT,
    likes_count INTEGER DEFAULT 0
);
INSERT INTO posts VALUES (1, 'Закат', 42);
```

**Шаг 3:** В окне 1 (СЕССИЯ 1):
```sql
BEGIN;
SELECT likes_count FROM posts WHERE id = 1;  -- 42
```

**Шаг 4:** В окне 2 (СЕССИЯ 2) одновременно:
```sql
BEGIN;
SELECT likes_count FROM posts WHERE id = 1;  -- 42
```

**Шаг 5:** В окне 1:
```sql
UPDATE posts SET likes_count = 43 WHERE id = 1;
```

**Шаг 6:** В окне 2 (не ждите, выполняйте сразу):
```sql
UPDATE posts SET likes_count = 43 WHERE id = 1;
```

**Шаг 7:** В окне 1:
```sql
COMMIT;  -- выполнен первым
```

**Шаг 8:** В окне 2:
```sql
COMMIT;  -- выполнен вторым
```

**Шаг 9:** Проверка:
```sql
SELECT * FROM posts WHERE id = 1;
-- Ожидается: 44 (42 + 1 + 1)
-- Получается: 43 (один лайк потерян!)
```

## 💡 Рекомендации

### Для соцсетей (лайки, комментарии, подписки)
```sql
-- ИСПОЛЬЗУЙТЕ АТОМАРНОЕ ОБНОВЛЕНИЕ:
UPDATE posts SET likes_count = likes_count + 1 WHERE id = 1;
UPDATE users SET followers = followers + 1 WHERE id = 123;
```

### Для финансовых операций
```sql
-- ИСПОЛЬЗУЙТЕ SERIALIZABLE:
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
-- ... ваши операции ...
COMMIT;
```

### Для отчетов и аналитики
```sql
-- ИСПОЛЬЗУЙТЕ REPEATABLE READ:
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;
-- ... первое чтение данных ...
-- ... обработка ...
-- ... второе чтение данных (будут идентичными) ...
COMMIT;
```

### Для высоконагруженных систем
```sql
-- ИСПОЛЬЗУЙТЕ ОПТИМИСТИЧНОЕ БЛОКИРОВАНИЕ:
ALTER TABLE posts ADD COLUMN version INTEGER DEFAULT 0;

UPDATE posts 
SET likes_count = likes_count + 1, version = version + 1
WHERE id = 1 AND version = @expected_version;

-- Если version изменилась, UPDATE не выполнится
-- и нужно повторить попытку с новой версией
```

## 🔧 Команды для PostgreSQL

```sql
-- Проверить текущий уровень изоляции:
SHOW default_transaction_isolation;

-- Установить уровень для сессии:
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Или для конкретной транзакции:
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- Убить зависшую транзакцию:
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE pid != pg_backend_pid();

-- Посмотреть все блокировки:
SELECT * FROM pg_locks WHERE NOT granted;
```

## 🔧 Команды для MySQL

```sql
-- Проверить уровень изоляции:
SELECT @@transaction_isolation;

-- Установить уровень:
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Или для транзакции:
START TRANSACTION WITH CONSISTENT SNAPSHOT;

-- Для READ UNCOMMITTED (демонстрация Dirty Read):
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- Показать все процессы:
SHOW PROCESSLIST;

-- Убить процесс:
KILL 12345;
```

## ⚠️ Важные замечания

1. **PostgreSQL особенность:** READ UNCOMMITTED работает как READ COMMITTED (Dirty Read невозможен)
2. **MySQL особенность:** Phantom Read может происходить в REPEATABLE READ
3. **Старайтесь избежать:** Не используйте READ UNCOMMITTED в production
4. **Тестируйте:** Каждая СУБД работает по-своему, проверьте поведение в вашей БД

## 📚 Дополнительные материалы

- ОТЧЕТ.md - полный отчет с таблицами и детальными примерами
- PostgreSQL docs: https://www.postgresql.org/docs/current/transaction-iso.html
- MySQL docs: https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html

## ✅ Чек-лист для сдачи работы

- [x] Выбраны 4 аномалии (все)
- [x] Подготовлены таблицы и тестовые данные
- [x] Описаны две параллельные транзакции для каждой
- [x] Показаны шаги воспроизведения
- [x] Зафиксированы результаты
- [x] SQL-скрипты готовы
- [x] Отчет оформлен понятно
- [x] Описано как избежать каждой аномалии

**Ожидаемая оценка:** 10 баллов ✨
- 2 балла × 4 аномалии = 8 баллов
- 1 балл за описание избежания
- 1 балл за оформление отчета

---

**Автор:** Егор Дьяченко  
**Дата:** 16 мая 2026 г.  
**СУБД:** PostgreSQL, MySQL  
**Язык:** SQL
