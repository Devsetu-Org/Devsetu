You are on the order box the morning after the crash. Every task in this lab is a search: which files match a rule (owner, size, age), and what to do with them. Looking through each folder by hand would be slow and easy to get wrong, so you use `find`.

`find` starts at a directory, walks everything below it, and keeps only the files that pass every test you give it. You can print the matches, delete them, or run a command on each one.

| Option | What it does |
| --- | --- |
| `-type f` | Keeps regular files only, not directories |
| `-name '*.conf'` | Keeps files whose name matches the pattern |
| `-user orders` | Keeps files owned by the user orders |
| `-size +10M` | Keeps files larger than 10 MiB |
| `-mtime -2` | Keeps files modified less than 2 days ago |
| `-delete` | Deletes each match |
| `-exec cp {} dir/ \;` | Runs cp on each match ({} is the file path) |

Always quote patterns like `'*.conf'`. Without quotes, the shell expands them in your current directory before `find` sees them. Work as `learner`, without `sudo`. Every file you need to read, delete or copy is already reachable from that account.

Names, sizes and dates are different on every learner's box, so run the commands instead of copying someone else's answers.

## 1. Configs owned by orders

```bash
mkdir -p ~/answers
find /srv -type f -name '*.conf' -user orders > ~/answers/orders-configs
```

`-user orders` keeps files owned by the service account. `-name '*.conf'` leaves out the `.txt` notes that `orders` also owns.

## 2. Dumps larger than 10 MiB

```bash
find /var/tmp/order-dumps -type f -size +10M -delete
```

`-size +10M` means more than 10 MiB, so the 9 MiB dump stays. Run the same `find` without `-delete` first if you want to see the list.

## 3. Configs changed in the last 2 days

```bash
mkdir -p ~/recent
find /etc/order-processor -type f -mtime -2 -exec cp {} ~/recent/ \;
```

`-mtime -2` means modified less than 2 days ago. `cp` copies each match and leaves the original in place.

Then **Submit**.
