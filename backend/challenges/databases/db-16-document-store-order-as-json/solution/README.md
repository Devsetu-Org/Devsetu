# Solution — Document Store: Order as JSON

## 1. Why a document?

The order page reads one order with its customer and items every time. In a relational schema that is four tables and joins; as a **document** it is one row (one read) holding the nested structure. The price: the customer's name/city is copied into each order document (denormalised), and cross-order analytics are harder.

`jsonb` stores JSON in a binary, indexable form. A `MongoDB` collection is the same idea.

## 2. Insert the nested order

Use the values from **your** ticket:

```sql
INSERT INTO order_docs (doc) VALUES ('{
  "order_id": 9421,
  "status": "pending",
  "total": 487.00,
  "customer": { "id": 7, "name": "Ada Learner", "city": "Pune" },
  "items": [
    { "sku": "SKU-003", "qty": 2, "price": 199.00 },
    { "sku": "SKU-947", "qty": 1, "price": 89.00 }
  ]
}');
```

Items live **inside** the document as an array, not in another table.

## 3. Query by nested fields

```sql
SELECT doc ->> 'order_id'
FROM order_docs
WHERE doc #>> '{customer,city}' = 'Pune'
  AND doc -> 'items' @> '[{"sku": "SKU-003"}]';
```

- `->` returns JSON, `->>` returns text; `#>>` follows a path.
- `@>` means "contains": the items array contains an object with that `sku`. Extra keys (qty, price) are allowed.
- The row you inserted must be in the result.

## 4. (Optional) make it fast

```sql
CREATE INDEX order_docs_doc_gin ON order_docs USING gin (doc jsonb_path_ops);
```

A GIN index accelerates `@>` lookups across all documents.

## 5. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql
```

Then **Submit**.
