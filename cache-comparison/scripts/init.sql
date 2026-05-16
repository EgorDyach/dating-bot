CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  stock INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (name, price, stock) VALUES
('Product 1', 10.00, 100),
('Product 2', 20.00, 200),
('Product 3', 30.00, 150),
('Product 4', 40.00, 120),
('Product 5', 50.00, 80);

-- Generate additional products for load testing
DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 6..1000 LOOP
    INSERT INTO products (name, price, stock) VALUES
      ('Product ' || i, (10 + (i % 500))::numeric / 10, 50 + (i % 200));
  END LOOP;
END $$;
