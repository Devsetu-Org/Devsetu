A teammate uploaded the v1.1 build by hand, and everything landed in `~/incoming`. Your job is to turn that pile into a clean `~/release` folder: make the folders, then move, copy, rename and delete files until each one is where your release lead asked for it. Every file belongs to you, so there's no `sudo` anywhere in this lab.

You only need the core file commands, plus **globs**. A glob is a pattern the shell expands before it runs the command. `*.conf` becomes the list of every name in the current folder that ends in `.conf`, so a single `mv` can move all three configs, including `payment handler.conf`, without you typing each name.

| Command | What it does |
| --- | --- |
| `ls -la` | Lists every file, including hidden ones, with details |
| `mkdir -p` | Creates folders, and their parents if needed |
| `mv` | Moves a file, or renames it if the target is a new name |
| `cp -p` | Copies a file and keeps its permissions and timestamps |
| `rm` | Deletes files (there is no recycle bin) |
| `rmdir` | Deletes a folder, only if it is empty |

When you type a name with a space yourself, quote it: `'payment handler.conf'`. Without quotes, the shell sees two names. Before you `rm` a glob, run `ls` with the same glob to see exactly what it matches.

## 1. Look first

```bash
cd ~/incoming
ls -la
```

You should see the binary, three `.conf` files, three `.log` files, `README`, three `.tmp` files and the empty `old` folder.

## 2. Build the layout

```bash
mkdir -p ~/release/{bin,config,logs}
```

The braces expand to three names, so this creates `bin`, `config` and `logs` in one command.

## 3. Move configs and logs

```bash
mv *.conf ~/release/config/
mv *.log ~/release/logs/
```

The glob passes `payment handler.conf` to `mv` as a single name, so the space doesn't break anything.

## 4. Copy the binary, move the README

```bash
cp -p order-processor ~/release/bin/
mv README ~/release/README.md
```

`cp` leaves the original in `~/incoming` for the checksum audit, and `-p` keeps it executable. `mv` to a new name moves and renames in one step.

## 5. Clean up

```bash
rm *.tmp
rmdir old
ls -A
```

`rmdir` refuses to delete a folder that isn't empty, which makes it a safe habit. `ls -A` should now show only `order-processor`.

Then **Submit**.
