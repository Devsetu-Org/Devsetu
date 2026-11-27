# Solution — N+1: One Query Instead of Fifty

## 1. See the N+1

```bash
~/legacy/load_orders.sh 17
# ... last line: queries issued: 51
```

One query lists the 50 orders, then one query per order fetches its items: 1 + N round-trips. Over a network each costs a latency hit, so 51 queries is slow even though each is "fast".

## 2. Let the database join

Use your customer id from the ticket:

```sql
SELECT o.id AS order_id,
       o.status,
       i.sku,
       i.qty,
       i.price
FROM orders o
LEFT JOIN order_items i ON i.order_id = o.id
WHERE o.customer_id = 17;
```

- `LEFT JOIN` keeps orders that have **no** items (their item columns are `NULL`). An inner `JOIN` would silently drop them, and the order list would be wrong.
- The result has one row per order/item pair; your application groups rows by `order_id`.
- Put `ORDER BY o.id` on it if the page needs a stable order. The grader does not care about order here.

## 3. Save and test

```bash
nano ~/answers/query.sql
psql -f ~/answers/query.sql | head
```

The file must hold exactly one statement. Then **Submit**.
