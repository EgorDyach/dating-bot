INSERT INTO "Customers" ("FirstName", "LastName", "Email")
SELECT 'Ivan', 'Petrov', 'ivan@example.com'
WHERE NOT EXISTS (
  SELECT 1 FROM "Customers" c WHERE c."Email" = 'ivan@example.com'
);

INSERT INTO "Customers" ("FirstName", "LastName", "Email")
SELECT 'Maria', 'Sidorova', 'maria@example.com'
WHERE NOT EXISTS (
  SELECT 1 FROM "Customers" c WHERE c."Email" = 'maria@example.com'
);

INSERT INTO "Products" ("ProductName", "Price")
SELECT 'Notebook', 12.50
WHERE NOT EXISTS (
  SELECT 1 FROM "Products" p WHERE p."ProductName" = 'Notebook'
);

INSERT INTO "Products" ("ProductName", "Price")
SELECT 'Pen', 1.25
WHERE NOT EXISTS (
  SELECT 1 FROM "Products" p WHERE p."ProductName" = 'Pen'
);
