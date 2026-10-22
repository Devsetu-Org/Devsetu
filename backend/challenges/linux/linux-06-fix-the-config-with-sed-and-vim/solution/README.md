There is no config-management tool on this box, so you edit `/etc/order-processor/app.conf` yourself. `sed` is for the repeatable changes: the same command would fix a hundred servers. `vim` is for the one new line that is not in the file yet. The file is owned by root, so these commands use `sudo`.

Copy the original first. If an edit goes wrong, the backup is the only copy of what the file used to say.

| Piece | What it does |
| --- | --- |
| `sed 's/old/new/g'` | Replaces every match. Without `-i` it only prints the result |
| `sed -i -e ...` | Writes the edits back into the file. Each `-e` is one edit |
| `\.` | A literal dot. A bare `.` matches any character |
| `/TODO/d` | Deletes every line that contains `TODO` |
| `^` | The start of a line, so `#metrics_port` is not matched mid-line |
| `vim` | Opens the file. `o` inserts a line below, `:wq` saves, `:q!` quits without saving |

## 1. Look, then back up

```bash
cat -n /etc/order-processor/app.conf
sudo cp /etc/order-processor/app.conf /etc/order-processor/app.conf.bak
```

## 2. The repeatable edits

Preview the host change before you write it:

```bash
sed 's/queue-old\.internal/queue.internal/g' /etc/order-processor/app.conf
```

Then apply all four edits:

```bash
sudo sed -i \
  -e 's/queue-old\.internal/queue.internal/g' \
  -e 's/^log_level = debug$/log_level = info/' \
  -e '/TODO/d' \
  -e 's/^#metrics_port/metrics_port/' \
  /etc/order-processor/app.conf
```

The first edit replaces both queue URLs. The payments endpoint is `payment.internal`, so this pattern does not touch it.

## 3. Add the line in vim

```bash
sudo vim /etc/order-processor/app.conf
```

1. Type `/\[queue\]` and press Enter to jump to the section.
2. Press `o`, type `max_retries = 5`, then press Esc.
3. Type `:wq` and press Enter.

Check the difference, then **Submit**:

```bash
diff /etc/order-processor/app.conf.bak /etc/order-processor/app.conf
```
