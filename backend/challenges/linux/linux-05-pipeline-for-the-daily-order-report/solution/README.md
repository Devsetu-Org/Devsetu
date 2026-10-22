The BI dashboard is down, so the morning numbers have to come from `/srv/orders/orders.csv`. Each tool does one job. A pipe (`|`) feeds one tool's output into the next.

The columns are `date`, `order_id`, `customer`, `region`, `status`, `amount`. `awk -F,` splits each line on commas, so `$4` is the region, `$5` is the status, and `$6` is the amount. `NR>1` skips the header row.

| Piece | What it does |
| --- | --- |
| `awk -F,` | Splits a CSV line into fields `$1`, `$2`, and so on |
| `sort` | Puts identical lines next to each other |
| `uniq -c` | Counts adjacent duplicates and prints `count text` |
| `sort -rn` | Sorts those counts numerically, highest first |
| `sort -u` | Sorts and drops duplicate lines |
| `>` | Sends normal output into a file |
| `2>` | Sends warnings into a different file |

`uniq` only merges lines that are already next to each other, so sort before you count.

```bash
mkdir -p ~/reports
cd /srv/orders
```

## 1. Top 3 regions

```bash
awk -F, 'NR>1 && $5=="completed" {print $4}' orders.csv | sort | uniq -c | sort -rn | head -3 > ~/reports/top-regions.txt
```

This keeps completed rows, prints the region, counts them, and keeps the three highest.

## 2. Total of completed amounts

```bash
awk -F, 'NR>1 && $5=="completed" {s += $6} END {printf "%.2f\n", s}' orders.csv > ~/reports/completed-total.txt
```

`END` runs after the last row and prints the sum with two decimal places.

## 3. Customers with a failed order

```bash
awk -F, 'NR>1 && $5=="failed" {print $3}' orders.csv | sort -u > ~/reports/failed-customers.txt
```

A `cancelled` row is not a failed order. `sort -u` lists each customer once.

## 4. Split the export

```bash
/opt/order-processor/bin/order-export > ~/reports/export.csv 2> ~/reports/export.err
```

`>` keeps the completed orders. `2>` keeps the skip warnings. Finance's spreadsheet is `export.csv` alone.

Then **Submit**.
