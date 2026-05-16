-- ===================================================
-- ГОТОВЫЕ СКРИПТЫ ДЛЯ ВОСПРОИЗВЕДЕНИЯ АНОМАЛИЙ
-- ===================================================
-- Используйте PostgreSQL или любую СУБД поддерживающую транзакции
-- Откройте 2 сессии/окна и копируйте команды строка за строй

-- ===================================================
-- АНОМАЛИЯ 1: LOST UPDATE (Потерянная запись)
-- ===================================================

-- ИНИЦИАЛИЗАЦИЯ:
DROP TABLE IF EXISTS posts CASCADE;
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0
);

INSERT INTO posts (id, title, likes_count) VALUES
(1, 'Красивый закат на пляже', 42);

SELECT * FROM posts WHERE id = 1; -- ПРОВЕРКА: должно быть 42 лайка

-- СЕССИЯ 1 (ОКНО 1 - Пользователь Иван):
-- Шаг 1.1:
BEGIN;
SELECT likes_count FROM posts WHERE id = 1; -- Результат: 42

-- Шаг 1.2: (ПАУЗА - ждем, пока Маша выполнит запрос)

-- Шаг 1.3:
UPDATE posts SET likes_count = 43 WHERE id = 1;

-- Шаг 1.4: (ПАУЗА - ждем, пока Маша закоммитит)

-- Шаг 1.5:
COMMIT; -- ИТОГ: должно быть 43

-- СЕССИЯ 2 (ОКНО 2 - Пользователь Маша):
-- Шаг 2.1:
BEGIN;
SELECT likes_count FROM posts WHERE id = 1; -- Результат: 42 (Иван еще не закоммитил)

-- Шаг 2.2:
UPDATE posts SET likes_count = 43 WHERE id = 1;

-- Шаг 2.3:
COMMIT; -- ИТОГ: 43

-- ПРОВЕРКА РЕЗУЛЬТАТА (любое окно):
-- SELECT * FROM posts WHERE id = 1;
-- ОЖИДАЕТСЯ: 44 (оба добавили по 1 лайку)
-- ПОЛУЧАЕТСЯ: 43 (один лайк потерялся)
--
-- КАК ИСПРАВИТЬ:
-- UPDATE posts SET likes_count = likes_count + 1 WHERE id = 1;

---

-- ===================================================
-- АНОМАЛИЯ 2: DIRTY READ (Грязное чтение)
-- ===================================================

-- ИНИЦИАЛИЗАЦИЯ:
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    sale_price DECIMAL(10, 2)
);

INSERT INTO products (id, name, price, sale_price) VALUES
(1, 'Ноутбук Pro', 100000.00, NULL);

-- УСТАНОВИТЬ УРОВЕНЬ ИЗОЛЯЦИИ (для демонстрации):
-- PostgreSQL по умолчанию READ COMMITTED, поэтому DIRTY READ не происходит
-- Для демонстрации нужно использовать MySQL с READ UNCOMMITTED

-- PostgreSQL СЕССИЯ 1 (ОКНО 1 - Администратор):
-- Шаг 1.1:
BEGIN;
UPDATE products SET sale_price = 50000.00 WHERE id = 1;
-- Шаг 1.2: (ПАУЗА - ждем, пока Алексей прочитает)
-- Шаг 1.3:
ROLLBACK; -- Администратор передумал!

-- Создание таблицы для заказов (нужна для dirty read примера):
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    product_id INTEGER,
    paid_price DECIMAL(10, 2)
);

-- PostgreSQL СЕССИЯ 2 (ОКНО 2 - Покупатель Алексей):
-- Шаг 2.1:
BEGIN;
SELECT sale_price FROM products WHERE id = 1; -- ГРЯЗНОЕ ЧТЕНИЕ: 50000 (не закоммичено!)
INSERT INTO orders (product_id, paid_price) VALUES (1, 50000.00);
-- Шаг 2.2:
COMMIT;

-- ПРОВЕРКА РЕЗУЛЬТАТА:
-- SELECT * FROM products WHERE id = 1;
-- sale_price = NULL (скидка отменена)
--
-- SELECT * FROM orders;
-- Алексей заказал товар по цене 50000, которая никогда не существовала!
-- Потеря магазина: 50000 рублей

---

-- ===================================================
-- АНОМАЛИЯ 3: NON-REPEATABLE READ
-- ===================================================

-- ИНИЦИАЛИЗАЦИЯ:
DROP TABLE IF EXISTS bank_accounts CASCADE;
CREATE TABLE bank_accounts (
    id SERIAL PRIMARY KEY,
    account_number TEXT NOT NULL,
    balance DECIMAL(12, 2) NOT NULL
);

INSERT INTO bank_accounts (id, account_number, balance) VALUES
(1, 'RU001', 100000.00),
(2, 'RU002', 50000.00),
(3, 'RU003', 75000.00);

SELECT SUM(balance) FROM bank_accounts; -- ПРОВЕРКА: 225000

-- СЕССИЯ 1 (ОКНО 1 - Бухгалтер Ольга):
-- Шаг 1.1:
BEGIN;
SELECT SUM(balance) FROM bank_accounts; -- Результат: 225000
-- Шаг 1.2: (ПАУЗА - сохраняем результат в переменную)
-- total_at_start = 225000
-- Шаг 1.3: (выполняем другие операции)

-- Шаг 1.4: (ПАУЗА - ждем, пока Павел обновит данные)

-- Шаг 1.5:
SELECT SUM(balance) FROM bank_accounts; -- НЕПОВТОРЯЮЩЕЕСЯ ЧТЕНИЕ!
-- Результат: 255000 (отличается от 225000!)

-- Шаг 1.6:
COMMIT;

-- СЕССИЯ 2 (ОКНО 2 - Операционист Павел):
-- Шаг 2.1:
BEGIN;
UPDATE bank_accounts SET balance = 150000.00 WHERE id = 1; -- +50000
UPDATE bank_accounts SET balance = 30000.00 WHERE id = 2;  -- -20000

-- Шаг 2.2:
COMMIT;

-- ПРОВЕРКА РЕЗУЛЬТАТА:
-- Данные читались в разные моменты времени!
-- Первое чтение:  225000
-- Второе чтение:  255000
-- Отчет некорректен!

-- КАК ИСПРАВИТЬ:
-- SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- или
-- SELECT SUM(balance) FROM bank_accounts FOR SHARE;

---

-- ===================================================
-- АНОМАЛИЯ 4: PHANTOM READ
-- ===================================================

-- ИНИЦИАЛИЗАЦИЯ:
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO orders (id, customer_name, status) VALUES
(1, 'ООО Газель', 'URGENT'),
(2, 'ИП Сидоров', 'URGENT'),
(3, 'МКД Петрова', 'NORMAL');

SELECT COUNT(*) as urgent_count FROM orders WHERE status = 'URGENT'; -- ПРОВЕРКА: 2

-- СЕССИЯ 1 (ОКНО 1 - Менеджер Сергей):
-- Шаг 1.1:
BEGIN;
SELECT COUNT(*) as urgent_count FROM orders WHERE status = 'URGENT'; -- Результат: 2
-- Шаг 1.2: (ПАУЗА - сохраняем результат и выполняем вычисления)
-- processing_time = 2 * 30 min = 60 min

-- Шаг 1.3: (ПАУЗА - ждем, пока клиенты добавят заказы)

-- Шаг 1.4:
SELECT COUNT(*) as urgent_count FROM orders WHERE status = 'URGENT'; -- ФАНТОМНОЕ ЧТЕНИЕ!
-- Результат: 4 (было 2, стало 4!)

-- Шаг 1.5:
COMMIT;

-- СЕССИЯ 2 (ОКНО 2 - Клиент 1):
-- Шаг 2.1:
BEGIN;
INSERT INTO orders (customer_name, status) VALUES ('ТК Логистика', 'URGENT');
-- Шаг 2.2:
COMMIT;

-- СЕССИЯ 3 (ОКНО 3 - Клиент 2):
-- Шаг 3.1:
BEGIN;
INSERT INTO orders (customer_name, status) VALUES ('ООО Транспорт', 'URGENT');
-- Шаг 3.2:
COMMIT;

-- ПРОВЕРКА РЕЗУЛЬТАТА:
-- SELECT * FROM orders WHERE status = 'URGENT';
-- Ожидалось: 2 заказа
-- Получено: 4 заказа (id=4, id=5 появились из ниоткуда)
-- План был на 60 минут, но есть 4 заказа = 120 минут!

-- КАК ИСПРАВИТЬ:
-- SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- или
-- SELECT * FROM orders WHERE status = 'URGENT' FOR UPDATE;

-- ===================================================
-- СПРАВКА ПО УРОВНЯМ ИЗОЛЯЦИИ В PostgreSQL
-- ===================================================

-- 1. READ UNCOMMITTED (не поддерживается, работает как READ COMMITTED)
--    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

-- 2. READ COMMITTED (по умолчанию)
--    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
--    Защита: от Dirty Read
--    Остаток: Lost Update, Non-rep. Read, Phantom Read

-- 3. REPEATABLE READ (в PostgreSQL использует MVCC)
--    SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
--    Защита: от Dirty Read, Non-rep. Read
--    Остаток: Lost Update, Phantom Read

-- 4. SERIALIZABLE (максимальная защита)
--    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
--    Защита: от всех аномалий
--    Цена: снижение производительности

-- ===================================================
-- ПОЛЕЗНЫЕ КОМАНДЫ
-- ===================================================

-- Проверить текущий уровень изоляции:
SHOW default_transaction_isolation;

-- Увидеть все открытые транзакции:
SELECT * FROM pg_stat_activity WHERE state != 'idle';

-- Убить зависшую транзакцию:
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid != pg_backend_pid();

-- Проверить блокировки:
SELECT * FROM pg_locks WHERE NOT granted;
