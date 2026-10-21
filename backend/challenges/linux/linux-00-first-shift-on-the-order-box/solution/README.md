You are logged in as **`learner`** on a real Ubuntu machine nicknamed the **order box**. That is the server that runs **order-processor** — the program that handles customer orders for the store.

Your job in this lab is not to fix or restart anything. It is to **orient yourself** the way an on-call engineer would on day one: who am I, which host is this, where do the app's files live, and what should I write down for the next person.

You will only need everyday shell navigation:

| Command | What it does |
| --- | --- |
| `whoami` | Prints your username |
| `hostname` | Prints the hostname of this machine |
| `pwd` | Prints your current directory (print working directory) |
| `ls` | Lists files in a directory (-a shows hidden names, -l adds detail, -S sorts by size) |
| `cd` | Changes directory |
| `cat` | Prints a file's contents |
| `grep` | Prints lines that match a pattern |
| `man` | Opens the manual page for a command (press q to quit) |

Work as `learner` the whole time. Do **not** use `sudo` — the notes file must be owned by you, or the grader will fail.

Values (version, port, log name) are **different for every learner**. Use what you read on your box, not the examples below.

## 1. Get your bearings

```bash
whoami
hostname
pwd
```

These print `learner`, `order-box` and `/home/learner` (`~` is a shortcut for your home directory). Comma-separated, they are **line 1** of your notes. Spaces after the commas are optional.

`ls /` shows the top-level folders (`home`, `opt`, `etc`, `var`) if you want a map of the machine. Don't put that listing in the notes.

## 2. Find the release version

```bash
ls -la /opt/order-processor
cat /opt/order-processor/.release
```

Plain `ls` skips names that start with a dot. `-a` shows them, so `.release` appears in the list. Its contents (for example `1.2.8`) are **line 2**.

## 3. Find the port

```bash
grep port /etc/order-processor/app.conf
```

You'll see something like `port = 8363`. Only the number goes on **line 3**.

## 4. Find the biggest log

```bash
ls -lS /var/log/order-processor
ls -S /var/log/order-processor | head -1
```

`-S` sorts by size, largest first, and `head -1` keeps the top line. The file name alone (for example `orders-2026-09-15.log`), not the full path, is **line 4**. If you forget a flag, run `man ls`, type `/size` to search, and press `q` to quit.

## 5. Write your notes

Replace the example values with what you found:

```bash
mkdir -p ~/notes
echo "learner, order-box, /home/learner" > ~/notes/first-shift.txt
echo "1.2.8" >> ~/notes/first-shift.txt
echo "8363" >> ~/notes/first-shift.txt
echo "orders-2026-09-15.log" >> ~/notes/first-shift.txt
cat ~/notes/first-shift.txt
```

`>` creates the file (or overwrites it), and `>>` adds a line to the end. `cat` should show four lines: bearings, version, port, log name.

Then **Submit**.
