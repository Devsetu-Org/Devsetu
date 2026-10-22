Finance wants the numbers from the raw payment-handler log, not from a dashboard. `grep` prints the lines that match a pattern. This log has four traps: letter case, a code that is the start of a longer code, a word sitting inside a longer word, and a comment that mentions timeout without setting it.

| Flag | What it does |
| --- | --- |
| `-i` | Ignores letter case |
| `-w` | Matches a whole word, so `E402` does not match `E4021` |
| `-c` | Counts matching lines |
| `-o` | Prints only the matched text |
| `-E` | Extended patterns, such as `{6}` |
| `-r` | Searches every file under a directory |
| `-l` | Prints the names of files that match |

```bash
cd /var/log/payment-handler
mkdir -p ~/answers
```

## 1. Every failed payment, in any case

```bash
grep -i 'failed' payments.log > ~/answers/failed.txt
```

`-i` keeps `FAILED`, `Failed`, and `failed`. The lines stay in log order.

## 2. How many E402s

```bash
grep -cw 'code=E402' payments.log > ~/answers/e402-count
```

Without `-w`, `E402` also matches `E4021`. The file should contain the number alone.

## 3. Unique order IDs on declined lines

```bash
grep -w 'declined' payments.log | grep -oE 'ORD-[0-9]{6}' | sort -u > ~/answers/declined-orders
```

The first `grep` keeps declined lines and skips `predeclined`. The second cuts out the order IDs. `sort -u` drops duplicates.

## 4. Configs that set a timeout

```bash
grep -rlE '^[a-z_]*timeout *=' /etc/payment-handler > ~/answers/timeout-configs
```

The name is not always `read_timeout`. The same line can be `timeout = 12s`, `read_timeout = 5s`, or `connect_timeout = 3s`. `^` means the match starts at the beginning of the line, so a comment like `# Timeouts are configured per gateway` is left out.

Then **Submit**.
