You just took the order box, and the outgoing engineer has left. Yesterday's log is a finished file of thousands of lines. The live log is still being written, and every 45 seconds it prints a **shift handoff code** so they can see you are watching the live file, not an old copy.

You do not edit either log. You read them and save small answers under `~/answers/`.

| Command | What it does |
| --- | --- |
| `less` | Opens a file you can page through. It does not load the whole file at once, so it is safe on a log with thousands of lines. |
| `wc -l` | Counts lines. |
| `head` | Prints the start of a file. |
| `tail` | Prints the end of a file. `tail -f` keeps printing new lines as they are written. |
| `sed -n 1500p` | Prints one numbered line. |

`>` sends a command's output into a file (and replaces that file if it already exists). Create the answers folder first:

```bash
mkdir -p ~/answers
cd /var/log/order-processor
ls -lh
```

## 1. Read yesterday's log

The file is `orders-2026-09-30.log`. Open it in a pager so you can move around it:

```bash
less orders-2026-09-30.log
```

Inside `less`:

- `Space` pages down, `b` pages up
- `g` jumps to the start, `G` jumps to the end
- `/ERROR` searches, `n` jumps to the next match
- `q` quits

Nothing from this step is saved. It is only so you know the file before you cut pieces out of it.

## 2. Count the lines

`wc -l` prints the count. If you pass the filename, `wc` also prints the name. `<` feeds the file on standard input, so the output is the number alone:

```bash
wc -l < orders-2026-09-30.log > ~/answers/line-count
cat ~/answers/line-count
```

## 3. Save the first 10 lines and the last 5

```bash
head -n 10 orders-2026-09-30.log > ~/answers/first-10.txt
tail -n 5 orders-2026-09-30.log > ~/answers/last-5.txt
```

`head -n 10` is the first 10 lines. `tail -n 5` is the last 5. Check both files with `cat` before you submit. They must match the log exactly, including blank lines.

## 4. Save line 1500

Line numbers start at 1. This prints only line 1500:

```bash
sed -n 1500p orders-2026-09-30.log > ~/answers/line-1500
```

The same line, built from `head` and `tail`:

```bash
head -n 1500 orders-2026-09-30.log | tail -n 1
```

## 5. Follow the live log and save the handoff code

`live.log` grows while you watch it. `tail -f` prints new lines until you stop it with `Ctrl+C`:

```bash
tail -f live.log
```

Every 45 seconds a line like this appears:

```text
NOTICE shift handoff code=K3X9QA
```

The six characters after `code=` are the handoff code. Write the **newest** one you see:

```bash
echo 'K3X9QA' > ~/answers/handoff-code
```

Use the code from your terminal, not the example. Then **Submit** before it rotates again. The grader accepts the latest code or the one just before it.

