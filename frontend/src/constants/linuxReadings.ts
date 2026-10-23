/** Linux track readings (blogs) interleaved with labs. Same shape as the Kubernetes readings. */

import { PLAY_DOMAINS } from './playCatalog';
import type { K8sReading, K8sTrackItem } from './k8sReadings';
import { LINUX_READINGS_EXTENDED } from './linuxReadingsExtended';
import terminalShellKernelImg from '../assets/linux-readings/meet-your-linux-machine/terminal-shell-kernel.png';
import filesystemTreeImg from '../assets/linux-readings/meet-your-linux-machine/filesystem-tree.png';
import absoluteVsRelativeImg from '../assets/linux-readings/meet-your-linux-machine/absolute-vs-relative.png';
import globExpansionImg from '../assets/linux-readings/files-and-folders/glob-expansion.png';
import findFunnelImg from '../assets/linux-readings/files-and-folders/find-funnel.png';
import findExecImg from '../assets/linux-readings/files-and-folders/find-exec.png';
import lessWindowImg from '../assets/linux-readings/reading-and-searching-text/less-window.png';
import viTwoModesImg from '../assets/linux-readings/reading-and-searching-text/vi-two-modes.png';
import grepSieveImg from '../assets/linux-readings/reading-and-searching-text/grep-sieve.png';
import readingARegexImg from '../assets/linux-readings/reading-and-searching-text/reading-a-regex.png';

export const LINUX_LABS_PATH = '/track/devops-engineer/linux';
export const LINUX_READINGS_BASE = `${LINUX_LABS_PATH}/read`;

export function linuxReadingPath(slug: string): string {
  return `${LINUX_READINGS_BASE}/${slug}`;
}

export const LINUX_READINGS: K8sReading[] = [
  {
    id: 'meet-your-linux-machine',
    slug: 'meet-your-linux-machine',
    trackId: 'B0',
    eyebrow: '',
    title: 'Meet Linux',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-00-first-shift-on-the-order-box',
    lede:
      'Start here if you are asking **what Linux is** and where it shows up in real life. No prior experience needed: we define Linux in plain language, give concrete examples, then map what you will see on a server (prompt, folders, paths). Commands come in the next readings.',
    sections: [
      {
        id: 'what-is-linux',
        title: 'What is Linux?',
        body: [],
        subsections: [
          {
            id: 'linux-as-an-os',
            title: 'Linux as an operating system',
            body: [
              '**Linux is an operating system (OS)** — the software that sits between you and the hardware. It runs applications, stores files on disk, uses the network, and drives the screen and keyboard. **Windows** and **macOS** are other operating systems you may already use every day; **Linux** is another major family, widely used where reliability and flexibility matter.',
              'In everyday conversation, **“Linux”** usually means a complete system you can use — applications, folders, users, and settings — the same kind of thing you mean when you say you use **Windows** or **Mac**. People talk that way all the time: “I’m on a Windows machine,” “mine’s a Mac,” or “I run Linux on my laptop.” Same idea: **which system** you are using, not the kernel’s name in isolation.',
            ],
          },
          {
            id: 'kernel-distro-open-source',
            title: 'Kernel, distro, and open source',
            body: [
              'Under the hood, the piece that does the heavy lifting is the **kernel** — it schedules applications on the CPU, uses memory, reads and writes the disk, and handles the network. **Linux** is the name of that kernel.',
              'You rarely install “only the kernel.” What you download or get on a cloud machine is a **distribution** (**distro**): the kernel **plus** the rest of the stack — command-line tools, installers, default packages, and docs. **Ubuntu**, **Debian**, **Fedora**, and **Alpine** are distros; they share the same core ideas and differ in what ships by default and how you install software.',
              'Linux is **free and open source**: anyone can read, modify, and redistribute the kernel and much of the software around it. Companies build products on top of it — Android, cloud platforms, appliances — instead of writing an OS from scratch.',
            ],
          },
        ],
        callout: {
          kind: 'idea',
          title: 'You have heard “server” many times. What is it?',
          body: [
            'A **server** is just a computer whose job is to **serve others** — websites, apps, databases — over the network, all day, every day. It usually sits in a data center with **no screen or keyboard**; people connect to it remotely and work through a **text prompt**.',
            'Most servers run **Linux**, and that is the Linux this track teaches.',
          ],
        },
      },
      {
        id: 'linux-in-the-wild',
        title: 'Linux in the wild: examples',
        body: [
          'You may already depend on Linux without seeing a “Linux desktop.” Concrete places it shows up:',
        ],
        table: {
          headers: ['Example', 'What Linux is doing', 'What you usually see'],
          rows: [
            [
              '**Android phone**',
              'The **Linux kernel** runs the device (CPU, memory, drivers).',
              'Android apps and settings — not a Linux login screen.',
            ],
            [
              '**Websites and APIs** (streaming, shopping, banking)',
              'Often run on **Linux servers** in a data center.',
              'The website or app — not the server OS.',
            ],
            [
              '**Cloud “virtual machines”**',
              'Many instances are **Ubuntu**, **Debian**, or similar distros.',
              'A dashboard in AWS/GCP/Azure; you SSH into a text prompt.',
            ],
            [
              '**Wi‑Fi router, smart TV, Raspberry Pi**',
              '**Embedded Linux** — small, fixed-purpose systems.',
              'The device’s own UI or no UI at all.',
            ],
            [
              '**Your laptop (maybe)**',
              'Some developers run **Linux desktop**; many use Windows or Mac.',
              'That is fine — this course gives you a **remote Linux lab** in the browser.',
            ],
          ],
        },
        after: [
          '**Takeaway:** “Linux” is not one product like “Windows 11.” It is a kernel and an ecosystem. You may use Linux **inside** a phone or website without ever seeing a Linux desktop. On this track you will mostly work on a **Linux server** you reach over the network.',
        ],
      },
      {
        id: 'parallels',
        title: 'Parallels: if you know Windows or Mac',
        body: [
          'Linux is not from another planet — many ideas match what you already use; labels and defaults differ.',
          'This table compares **desktop habits** on Windows or Mac to a **Linux server** (the kind you reach over the network for ops work). **Linux on a laptop with a desktop** — Ubuntu, Fedora, and other distros with icons and a browser — feels closer to the Windows/Mac column. **This reading** emphasizes the **Linux server** column because that is what production ops and the hands-on labs on this track use.',
        ],
        table: {
          headers: ['Idea', 'Windows (roughly)', 'macOS (roughly)', 'Linux server'],
          rows: [
            ['Desktop and apps', 'Start menu, File Explorer', 'Finder, Dock', 'Often **none** — connect over the network and use a shell'],
            ['Where files live', '`C:\\`, `D:\\` drive letters', '`/Users/you` under one disk', '**One tree** from `/` — no `C:` or `D:`'],
            ['System settings', 'Registry, `Program Files`', '`/Library`, Unix `/etc` on disk', 'Mostly plain files under **`/etc`**'],
            ['Your personal files', '`C:\\Users\\You`', '`/Users/you`', '**`/home/you`**'],
            ['Logs and changing data', 'Event Viewer, AppData', 'Console, `~/Library/Logs`', '**`/var/log`**, **`/var`**'],
            ['Run something', 'Double-click an `.exe`', 'Open an `.app` or Terminal', 'Type a **command**; the shell finds the application'],
          ],
        },
        after: [
          'Many Linux **servers** (and other Linux machines you use remotely) **do not show a desktop**. There is no Start menu or file browser on the screen — you work through a **shell**, a text interface. Day-to-day ops happens there.',
          'When you **connect** to such a machine, you typically get a **text prompt** and one **folder tree** you navigate with commands (covered in the next sections). In a lab, DevSetu opens that connection for you in the browser.',
        ],
      },
      {
        id: 'terminal-shell-kernel',
        title: 'Inside a Linux machine: kernel, shell, terminal',
        body: [
          'Three layers sit between you and the hardware on any Linux machine. Picture them from the **outside in**: you type into the **terminal**, the **shell** works out what you meant, and the **kernel** does the actual work.',
        ],
        subsections: [
          {
            id: 'terminal',
            title: 'Terminal: the window you type into',
            body: [
              'The **terminal** is the text window: it shows characters and sends your keystrokes along. It does **not** understand commands itself — type `ls` and the terminal just passes the letters `l`, `s` and Enter to the program running inside it, then draws whatever text comes back.',
              'The name comes from old **hardware terminals**: a screen and keyboard wired to a big shared computer in another room. Today it is an app — **Terminal** or **iTerm** on a Mac, **Windows Terminal** on Windows, the panel on the right in a DevSetu lab. When you connect to a server, the terminal is on **your** laptop, but the commands run on the **server**.',
            ],
          },
          {
            id: 'shell',
            title: 'Shell: the program that understands your commands',
            body: [
              'The **shell** is the program running inside the terminal. It prints the **prompt**, waits for a line, and when you press Enter it reads the line, splits it into words, expands shortcuts like `~` (your home folder) and `*` (matching file names), finds the program you named (for example `/usr/bin/ls`), and asks the kernel to start it. When that program finishes, the shell prints the prompt again.',
              'It also gives you comforts on top: **command history** (Up arrow), **Tab completion** for commands and paths, **variables**, and **scripts** — a file of commands the shell runs top to bottom. The most common shell on Linux servers is **bash**; others include **zsh** (the macOS default) and the minimal **sh**. They all work the same basic way.',
            ],
          },
          {
            id: 'kernel',
            title: 'Kernel: the part that touches the hardware',
            body: [
              'The **kernel** is the core of Linux. It starts and stops programs, gives them memory and CPU time, reads and writes files on disk, and talks to the network. No program — not even the shell — touches the hardware directly; they all ask the kernel.',
            ],
          },
        ],
        figure: {
          image: terminalShellKernelImg,
          imageAlt:
            'Hand-drawn sketch: a person types into a terminal; inside it the shell reads the line and the kernel runs programs and reads files',
          caption: 'You type in the terminal; the shell interprets; the kernel does the work.',
          flush: true,
        },
        after: [
          'After you connect, you typically see a **prompt** — a line of text and a blinking cursor, for example `student@linux-lab:~$`. It is the shell telling you who you are, which machine you are on, and which folder you are in. The `$` means a normal user; `#` would mean the superuser account (**root**), so treat that with extra care.',
        ],
        tableAfter: {
          headers: ['Prompt part', 'Meaning'],
          rows: [
            ['`student`', 'The user you are logged in as'],
            ['`@linux-lab`', 'The machine (hostname)'],
            ['`~`', 'The current folder; `~` is shorthand for your home directory, e.g. `/home/student`'],
            ['`$`', 'Normal user ( `#` = root )'],
          ],
        },
      },
      {
        id: 'filesystem-map',
        title: 'One filesystem: a single tree from /',
        body: [
          'On **Windows**, **`C:`** and **`D:`** are **drive letters** — different disks or partitions get different letters, and paths look like `C:\\Users\\You\\file.txt`. Linux does **not** use drive letters. Everything hangs from one root folder, written `/`. Extra disks are attached **inside** that tree (called **mounting**, covered later), so you still see one hierarchy of folders.',
          'Each top-level folder has a conventional job. Learn these once and you can guess where things live on almost any Linux machine.',
        ],
        figure: {
          image: filesystemTreeImg,
          imageAlt:
            'Hand-drawn tree: the root folder / with branches to /etc, /home, /var, /opt, /tmp, /usr, /dev and /proc',
          caption: 'One tree. Every folder has a job.',
          flush: true,
        },
        tableAfter: {
          headers: ['Folder', 'What it is for', 'Examples'],
          rows: [
            [
              '`/etc`',
              'System and service **configuration** (plain text)',
              '`/etc/hostname`, `/etc/ssh/sshd_config`',
            ],
            [
              '`/home`',
              'Each **user’s** own files and settings',
              '`/home/student/notes.txt`, `~/.ssh`',
            ],
            [
              '`/var/log`',
              '**Logs** written while the system runs',
              '`/var/log/syslog`, `/var/log/nginx/access.log`',
            ],
            [
              '`/opt`',
              'Optional **third-party** applications',
              'Vendor bundles under `/opt/myapp/`',
            ],
            [
              '`/tmp`',
              '**Temporary** files (may be deleted on reboot)',
              'Short-lived exports, installer scratch',
            ],
            [
              '`/usr/bin`',
              'User-facing **commands** the shell runs',
              '`ls`, `grep`, `python3`',
            ],
            [
              '`/proc`',
              'Live view of **processes** and kernel stats',
              '`/proc/uptime`, one folder per running process',
            ],
          ],
        },
        callout: {
          kind: 'scope',
          title: 'Everything is a file',
          body: [
            'Linux exposes a lot of the system as files: devices under `/dev`, process information under `/proc`, and so on. That single idea is why the same few tools can inspect so many different things — you will use them in later readings and labs.',
          ],
        },
      },
      {
        id: 'paths',
        title: 'Paths: absolute and relative',
        body: [
          'A **path** is directions to a file or folder. **Absolute** paths start at `/` and spell the full route, e.g. `/var/log/app.log`. They mean the same thing no matter which folder you are standing in — like `C:\\Users\\Alice\\file.txt` on Windows always pointing to the same place.',
          '**Relative** paths start from your **current folder**. From `/var/lib`, the same log might be written `../log/app.log` (`..` means one folder up). That depends on where you are, like a path relative to whichever folder File Explorer is showing.',
        ],
        figure: {
          image: absoluteVsRelativeImg,
          imageAlt:
            'Hand-drawn comparison: absolute path /var/log/app.log from the root, relative path ../log/app.log from /var/lib',
          caption: 'Absolute starts at the root. Relative starts where you stand.',
          flush: true,
        },
        table: {
          headers: ['Symbol', 'Meaning'],
          rows: [
            ['`/`', 'Root of the whole tree'],
            ['`~`', 'Your home directory'],
            ['`.`', 'The folder you are in now'],
            ['`..`', 'One folder up'],
          ],
        },
      },
      {
        id: 'saved-for-later',
        title: 'What we save for later',
        body: [
          'This reading stops at the map. Deliberately left for the next readings:',
        ],
        bullets: [
          'How commands are structured (program, options, arguments) and keyboard habits like Tab completion.',
          'Listing folders, reading files, and built-in help (`man`, `--help`).',
          'Copying, moving, finding files, and searching text in logs.',
          'Users, permissions, processes, systemd, and the rest of the track.',
        ],
        callout: {
          kind: 'tip',
          title: 'Help lives on the machine',
          body: [
            'Linux ships documentation with the system. You do not need to memorize every command — you need to know the map and where to look. **B1** and later posts show how.',
          ],
        },
      },
    ],
    takeaways: [
      '**Linux** is an **operating system** (kernel + tools); **distros** like Ubuntu package it for servers and desktops. You may already use it via **Android**, **websites**, or **cloud VMs** without seeing a Linux desktop.',
      'A **server** is a computer that runs services for others, often reached **remotely** through a text interface — not a desktop like your laptop.',
      'The **terminal** shows text and sends keystrokes; the **shell** (usually **bash**) reads your line, expands it, and starts programs; the **kernel** runs them and touches the hardware.',
      'Linux has **one tree from `/`** (no `C:`/`D:` drive letters). **`/etc`**, **`/home`**, **`/var/log`**, and **`/tmp`** are folders you will visit often.',
      'Paths can be **absolute** (from `/`) or **relative** (from where you stand); `~`, `.`, and `..` are shortcuts.',
      '**Commands** start in **B1** — this post is just the map.',
    ],
    relatedLabsIntro:
      'This post is a primer with no lab of its own. Continue with **B1 — Files and folders** when you are ready for commands.',
    relatedLabs: [],
  },
  {
    id: 'files-and-folders',
    slug: 'files-and-folders',
    trackId: 'B1',
    eyebrow: '',
    title: 'Files and Folders: List, Organize, Find',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-01-organize-the-release-folder',
    lede:
      'You already have the map: prompt, shell, one tree from `/`, absolute and relative paths. This post is the next step — **commands** to see where you are, list what is in a folder, create and tidy files, and **find** things when they are not where you expect.',
    sections: [
      {
        id: 'from-b0',
        title: 'Where you left off',
        body: [
          'On a remote Linux **server**, you usually do not click through folders in a file browser. You connect in a **terminal** (the text window), type a line at the **prompt**, and the **shell** interprets it and starts programs; the **kernel** runs those programs and talks to disk and network — **executes here**, at the bottom of the stack.',
          'Files live in **one tree** starting at `/`. Your personal area is **`~`** (often `/home/you`). A **path** can be **absolute** — full directions from `/`, e.g. `/var/log/app.log` — or **relative** to the folder you are in now, e.g. `notes/today.txt` or `../config/app.conf`. This reading puts that map to work: **list** what is in a folder, **organize** files without losing any, and **search** the tree when something is not where you expect.',
        ],
        callout: {
          kind: 'tip',
          title: 'You do not need to memorize everything',
          body: [
            'Linux ships **help on the machine** (`--help`, `man`). Learn a small set of habits and know **where to look** when you forget a flag — memorizing every option is not the goal.',
          ],
        },
      },
      {
        id: 'how-commands-work',
        title: 'How a command line is built',
        body: [
          'Each line you type is **command**, then **options**, then **arguments**. Options usually start with a dash. A double dash (`--`) starts a long option name. **`ls`**, **`cp`**, and **`mkdir`** are programs on disk, usually under `/usr/bin`. The shell finds the program and starts it. It does not contain those commands itself.',
        ],
        subsections: [
          {
            id: 'pwd-cd-ls',
            title: 'pwd, cd, and ls: where you are',
            body: [
              '**`pwd`** prints the folder you are standing in. **`cd`** moves you. **`cd ..`** goes up one folder. **`cd ~`** goes to your home folder. **`~`** is a shortcut the shell expands before the command runs.',
              '**`ls`** prints the names in the current folder. **`ls -l`** adds the owner, size, and date. **`ls -a`** also shows hidden names, the ones that start with a dot. A plain **`ls`** hides those, and a glob **`*`** hides them too.',
            ],
            code: {
              language: 'shell',
              code: `pwd
cd ~/projects
cd ..
ls
ls -l
ls -a`,
            },
          },
        ],
        table: {
          headers: ['Piece', 'Role', 'Example on one line'],
          rows: [
            [
              'Command',
              'Which **program** to run — the first word on the line',
              '`ls` lists names; `mkdir` creates a folder; `cp` copies',
            ],
            [
              'Options',
              'Short or long **flags** that change behavior (often after the command)',
              '`ls -l` adds size and dates; `mkdir -p` creates missing parents; `cp -i` asks before overwrite',
            ],
            [
              'Arguments',
              '**Operands** the command acts on — usually paths or names at the end',
              '`cd ~/projects` changes folder; `cp notes.txt backup.txt` names source and destination',
            ],
          ],
        },
        after: [
          '**`command --help`** prints a short summary. **`man command`** opens the full manual. Press **`q`** to leave it. Type the start of a command or a path and press **Tab**. The shell fills in the rest, or shows the choices.',
        ],
      },
      {
        id: 'core-five',
        title: 'The core five: make, copy, move, delete',
        body: [
          'Most file work is a handful of commands. Each one does one job. The option next to it is the one you will actually use.',
        ],
        subsections: [
          {
            id: 'mkdir-touch',
            title: 'mkdir and touch: make a folder or an empty file',
            body: [
              '**`mkdir`** creates a folder. **`-p`** creates any missing parent folders and does not complain if the folder is already there. **`mkdir docs/2026`** fails when **`docs`** does not exist. **`mkdir -p docs/2026`** creates both.',
              '**`touch`** creates an empty file, or updates the timestamp if the file already exists. It does not write any contents.',
            ],
            code: {
              language: 'shell',
              code: `mkdir -p ~/projects/docs
touch ~/projects/docs/todo.txt`,
            },
          },
          {
            id: 'cp-mv',
            title: 'cp copies, mv moves or renames',
            body: [
              '**`cp`** makes a second copy. The original stays where it was. **`-r`** copies a folder and everything inside it. **`-a`** does that and also keeps the timestamps and permissions. Plain **`cp`** is enough when those details do not matter.',
              '**`mv`** changes the name, or moves the file into another folder. On the same disk that is just a rename in the directory listing, so it is fast even for a large file. Across disks, **`mv`** copies and then deletes the original. **`mv`** and **`cp`** both replace a file that already has the destination name, without asking, unless you add **`-i`**.',
            ],
            code: {
              language: 'shell',
              code: `cp notes.txt notes-backup.txt
cp -a docs/ docs-old/
mv draft.txt final.txt
mv final.txt ~/projects/docs/`,
            },
          },
          {
            id: 'rm-rmdir',
            title: 'rm and rmdir: delete',
            body: [
              '**`rm`** deletes a file immediately. There is no recycle bin. **`rm -r`** deletes a folder and everything inside that folder. It does not delete the rest of the disk. **`rmdir`** deletes a folder only when the folder is empty, so it is the safe check.',
              'Before **`rm`** or **`mv`** with a pattern, run **`ls`** with the same names and read the list.',
            ],
            code: {
              language: 'shell',
              code: `rm scratch.tmp
rmdir ~/projects/old`,
            },
          },
        ],
        table: {
          headers: ['Command', 'Does', 'The option you want'],
          rows: [
            ['`mkdir`', 'Makes a folder', '`-p`: make parents too, no error if it exists'],
            ['`touch`', 'Makes an empty file', 'Updates the timestamp if the file already exists'],
            ['`cp`', 'Copies. The original stays', '`-r` for folders; `-a` to keep dates and permissions'],
            ['`mv`', 'Moves **or renames**', '`-i`: ask before overwriting'],
            ['`rm`', 'Deletes files', '`-r` for folders; `-i` to confirm each'],
            ['`rmdir`', 'Deletes an **empty** folder', 'Refuses if anything is inside: a safe check'],
          ],
        },
        callout: {
          kind: 'warn',
          title: 'There is no recycle bin',
          body: [
            '`rm` deletes immediately, and `rm -r` removes a folder and **everything inside it** (the whole folder tree under that name — not “the whole disk,” just that branch). `mv` and `cp` silently overwrite a file with the same name. Look before you act: run `ls` with the same names first, and use `-i` when you are unsure.',
          ],
        },
      },
      {
        id: 'globs',
        title: 'Globs: patterns the shell expands',
        body: [
          'A **glob** is a **filename pattern** — wildcards like `*` and `?` that stand in for part of a name, so you can name a whole group of files at once instead of typing each one. The important part is *who* expands it: the **shell**, before the command runs. The command only sees the finished list of names.',
          'For the examples below, picture a folder with these files: `report.pdf`, `slides.pdf`, `notes.txt`, `2024-summary.txt`, `photo-1.jpg`, `photo-2.jpg`, and `photo-10.jpg`.',
        ],
        tableAfter: {
          headers: ['Pattern', 'What it matches', 'Example (you type → shell expands to)'],
          rows: [
            [
              '`*`',
              'Any characters in that spot, including none — “anything here”',
              '`*.pdf` → `report.pdf` `slides.pdf`',
            ],
            [
              '`?`',
              'Exactly **one** character',
              '`photo-?.jpg` → `photo-1.jpg` `photo-2.jpg` (not `photo-10.jpg`, which has two characters there)',
            ],
            [
              '`[12]`, `[0-9]`',
              'Exactly one character, chosen from the set or range in the brackets',
              '`photo-[12].jpg` → `photo-1.jpg` `photo-2.jpg`',
            ],
            [
              '`[!0-9]`',
              'Exactly one character that is **not** in the set. A `!` right after `[` flips the set: `[0-9]` is “any digit”, `[!0-9]` is “anything except a digit”',
              '`[!0-9]*.txt` → `notes.txt` (first character must not be a digit, so `2024-summary.txt` is left out)',
            ],
            [
              '`{a,b}`',
              '**Brace expansion**: not a match against files — the shell simply writes the word out once for **each** option inside the braces, whether or not such files exist',
              '`mkdir {jan,feb,mar}` → `mkdir jan feb mar`; `*.{pdf,txt}` → `*.pdf *.txt` → `report.pdf` `slides.pdf` `notes.txt` `2024-summary.txt`',
            ],
          ],
        },
        figure: {
          image: globExpansionImg,
          imageAlt:
            'Hand-drawn flow: you type cp *.jpg photos/, the shell expands it to cp fox.jpg owl.jpg deer.jpg photos/, then cp copies',
          caption: 'You write a pattern. The shell writes the list. The command never sees the star.',
          flush: true,
        },
        after: [
          '**`[!...]` in more detail:** the brackets always stand for **exactly one** character. Without `!`, that character must be one of the ones listed; with `!` as the first thing inside, it must be anything **except** those. So `[!0-9]*` reads as “one non-digit, then anything” — every name that does not start with a number.',
          '**`{a,b}` in more detail:** braces are about **building words**, not finding files. The shell copies the text around the braces once per comma-separated option: `report.{pdf,txt}` becomes `report.pdf report.txt` even if neither file exists. That makes braces handy for creating several folders at once, and when the result contains a glob (`*.{pdf,txt}` → `*.pdf *.txt`), each glob is then expanded as usual.',
        ],
        code: {
          language: 'shell',
          code: `ls *.pdf             # report.pdf  slides.pdf
ls photo-?.jpg       # photo-1.jpg  photo-2.jpg
ls photo-[12].jpg    # photo-1.jpg  photo-2.jpg
ls [!0-9]*.txt       # notes.txt  (2024-summary.txt starts with a digit)
ls *.{pdf,txt}       # report.pdf  slides.pdf  notes.txt  2024-summary.txt
mkdir {jan,feb,mar}  # runs: mkdir jan feb mar`,
        },
        callout: {
          kind: 'warn',
          title: 'Three things that trip everyone up',
          body: [
            '**Case matters**: `*.pdf` does not match `Slides.PDF`. **Hidden files are skipped**: `*` does not match names starting with a dot. **No match, no expansion**: if nothing matches, bash passes the pattern through unchanged and you get `cannot stat \'*.png\': No such file or directory`.',
            'Before **`rm`** or **`mv`** with a glob, run **`ls`** with the same pattern so you see the list first.',
          ],
        },
      },
      {
        id: 'quoting',
        title: 'Quoting: spaces and special characters',
        body: [
          'The shell splits your line into **words** at every space — that is how it finds the command and its arguments. A file named **`holiday photo.jpg`** becomes **two** words (`holiday` and `photo.jpg`) unless you **quote** or **escape** the space.',
          'The table below is about **how the shell reads each style** before your command runs. “Expands `$var`?” means: if you stored a path in a variable, does the shell substitute it? “Expands globs?” means: does `*` turn into a list of matching files in the **current** folder?',
        ],
        table: {
          headers: ['Style', 'Expands `$var`?', 'Expands globs?', 'When to use it'],
          rows: [
            [
              '`\'single quotes\'`',
              'No — everything inside is literal',
              'No — `*` stays a star',
              'Awkward file names: spaces, `$`, `*` exactly as typed',
            ],
            [
              '`"double quotes"`',
              'Yes — `$HOME` becomes your path',
              'No — safe to hold a variable path with spaces',
              'Almost always for `"$file"` when `file` comes from a variable',
            ],
            [
              '`\\` escape',
              'No',
              'No',
              'One special character, e.g. a space in an otherwise plain name',
            ],
            [
              'No quotes',
              'Yes',
              'Yes — `*.pdf` may expand here',
              'Simple one-word names and intentional globs only',
            ],
          ],
        },
        code: {
          language: 'shell',
          code: `mv 'holiday photo.jpg' ~/pictures/  # single quotes: one name
mv holiday\\ photo.jpg ~/pictures/   # backslash escapes the space
img='holiday photo.jpg'             # store the name in a variable
mv "$img" ~/pictures/               # double quotes keep it one name`,
        },
        callout: {
          kind: 'warn',
          title: 'Always quote variables',
          body: [
            'Writing `$file` without quotes works until the day a name contains a space, and then the command acts on the wrong files. Make `"$file"` a reflex.',
          ],
        },
      },
      {
        id: 'what-is-find',
        title: 'What is find?',
        body: [
          'Globs only look in **one folder**. When a file might be anywhere under your home folder, deep inside **`~/projects`**, or in a scratch area like **`/tmp`**, you need a tool that **walks** from a starting folder down through subfolders and filters each path. That tool is **`find`**.',
          'Every **`find`** line has the same shape: **where** to start, **tests** each path must pass, and an **action** (printing paths is the default). The funnel picture is that idea: every file under the start folder is checked; only paths that pass all tests are kept.',
          'The sign in front of a number is the part people reverse. **`+`** means more than. **`-`** means less than. **`-size +10M`** is larger than 10 megabytes. **`-mtime -2`** was changed within the last 2 days. **`-mtime +2`** was changed more than 2 days ago. Quote the pattern (`-name \'*.conf\'`) so the shell does not expand the star in the folder you are standing in.',
        ],
        figure: {
          image: findFunnelImg,
          imageAlt:
            'Hand-drawn funnel: every file in the folder falls through filters for name, size and age; two matches come out',
          caption:
            'Example: `find ~/projects -type f -size +1M -mtime -7` — start at `~/projects`, keep only **files** (`-type f`) larger than 1 MiB (`-size +1M`) touched in the last 7 days (`-mtime -7`).',
          flush: true,
        },
        tableAfter: {
          headers: ['Test', 'What it checks', 'Example (what it means)'],
          rows: [
            [
              '`-name` / `-iname`',
              'File name matches a pattern (`i` = ignore case)',
              '`-iname \'*.pdf\'` → names ending in `.pdf` or `.PDF` anywhere in the tree',
            ],
            [
              '`-type`',
              'Kind of path: `f` file, `d` directory, `l` symlink',
              '`-type f` → skip folders; only regular files',
            ],
            [
              '`-size`',
              'File size; `+` bigger than, `-` smaller than',
              '`-size +10M` → larger than 10 megabytes',
            ],
            [
              '`-mtime`',
              'Last **content** change, in days; sign like `-size`',
              '`-mtime -7` → changed within the last week',
            ],
            [
              '`-newer`',
              'Modified more recently than another file’s timestamp',
              '`-newer backup.stamp` → edited after you created the stamp file',
            ],
            [
              '`-user` / `-group`',
              'Owner user or group on disk',
              '`-user student` → files owned by `student`',
            ],
            [
              '`-empty`',
              'Zero-byte file or directory with nothing inside',
              '`-type d -empty` → empty folders',
            ],
            [
              '`-maxdepth`',
              'Do not descend past N levels below the start path',
              '`-maxdepth 1` → this folder only, no subfolders',
            ],
          ],
        },
        code: {
          language: 'shell',
          code: `find ~/projects -type f -size +1M -mtime -7   # files over 1 MiB changed this week
find ~ -iname '*.pdf'                          # every PDF under my home folder
find /tmp -type d -empty                       # empty folders in /tmp`,
        },
        after: [
          'Quote patterns (`-name \'*.pdf\'`) so the shell does not expand `*` in your **current** folder first. Tests combine with **AND** by default; use `-o` for OR and `!` for NOT, with `\\(` `\\)` around groups when the shell would otherwise steal the parentheses.',
        ],
      },
      {
        id: 'find-actions',
        title: 'Acting on what you find',
        body: [
          'Printing paths is the default **action**. The point of filtering first is that you can **keep working on that same set**: run another command on each match (`-exec`), delete them (`-delete`), or copy them — instead of copying paths by hand. Think of **`find`** as “build a list, then do something with the list.”',
        ],
        figure: {
          image: findExecImg,
          imageAlt:
            'Hand-drawn sketch: find results a.raw b.raw c.raw fed into the template mv {} rejects/, producing one mv per file',
          caption: '{} is replaced by each file. Print first, act second.',
          flush: true,
        },
        tableAfter: {
          headers: ['Action', 'Does', 'Note'],
          rows: [
            ['`-print`', 'Prints each path', 'The default'],
            ['`-delete`', 'Deletes each match', 'Put it last; test with `-print` first'],
            ['`-exec cmd {} \\;`', 'Runs `cmd` once per file', '`{}` becomes the path'],
            ['`-exec cmd {} +`', 'Runs `cmd` with many files at once', 'Faster; `{}` must come last'],
            ['`-ok cmd {} \\;`', 'Like `-exec`, but asks first', 'Good for risky commands'],
          ],
        },
        code: {
          language: 'shell',
          code: `find ~/projects -name '*.tmp'                                   # 1. look
find ~/projects -name '*.tmp' -exec rm {} \\;                    # 2. delete each match
find ~/Downloads -name '*.pdf' -exec cp {} ~/projects/docs/ \\;  # copy each PDF into docs`,
        },
        callout: {
          kind: 'warn',
          title: 'Run it without the action first',
          body: [
            'A `find` that deletes or moves the wrong files does it to all of them, instantly. Run the same command with just the tests, read the list, then add `-delete` or `-exec`.',
          ],
        },
      },
      {
        id: 'when-not-find',
        title: 'When find is not enough',
        body: [
          '**`find`** is for “which **paths** match these rules?” Other questions need different tools. The third column explains why **`find`** is or is not the right first choice.',
        ],
        table: {
          headers: ['Need', 'Use find?', 'Why', 'Reach for instead'],
          rows: [
            [
              'Files by name, size, age, or owner anywhere under a folder',
              'Yes',
              'It walks the tree and tests each file — exactly what **`find`** is for',
              '`find ~/projects -type f -size +1M`',
            ],
            [
              'Files in **one** folder matching `*.pdf`',
              'Overkill',
              'You already know the folder; a glob is shorter and faster to type',
              '`ls *.pdf` or `mv *.pdf docs/`',
            ],
            [
              'Files **containing** certain text inside',
              'No',
              '**`find`** sees names and metadata, not file contents',
              '`grep -r` (covered in the next reading)',
            ],
            [
              'Total disk space used by a folder',
              'No',
              '**`find`** lists paths; it does not add up sizes for one summary',
              '`du -sh ~/projects`',
            ],
            [
              'Instant name lookup across the whole disk',
              'Often too slow',
              '**`find`** scans live every time; an index can answer in milliseconds if your admin installed one',
              '`locate filename` (when available)',
            ],
          ],
        },
      },
      {
        id: 'more-of-the-map',
        title: 'Quick reference',
        body: [
          'Keep this table handy; **`man`** and **`--help`** fill in the rest. Heavier tools (**`rsync`**, links, **`xargs`**) show up later on the track.',
        ],
        tableAfter: {
          headers: ['Task', 'Command'],
          rows: [
            ['Where am I / go there', '`pwd`, `cd path`'],
            ['List a folder', '`ls`, `ls -l`'],
            ['Make nested folders', '`mkdir -p a/b/c`'],
            ['Make an empty file', '`touch notes.txt`'],
            ['Show hidden names', '`ls -a`'],
            ['Copy keeping mode/time', '`cp -p file dest/`'],
            ['Copy a folder tree', '`cp -a src/ dest/`'],
            ['Rename or move', '`mv old new`'],
            ['Preview a glob', '`ls *.pdf`'],
            ['Find by tests', '`find ~/projects -type f -name \'*.pdf\'`'],
            ['Act on matches', '`find ... -exec cmd {} \\;`'],
          ],
        },
      },
    ],
    takeaways: [
      'A command line is **command**, then **options**, then **arguments**. **`pwd`**, **`cd`**, and **`ls -a`** show where you are, including hidden names. **`--help`**, **`man`**, and **Tab** cover the rest.',
      '**`mkdir -p`** makes folders. **`touch`** makes an empty file. **`cp`** copies and **`mv`** renames or moves. **`rm`** deletes immediately. There is no recycle bin. Preview a pattern with **`ls`** before **`rm`** or **`mv`**.',
      '**Globs** are expanded by the **shell** before the program runs; quote names with spaces and always write **`"$var"`**.',
      '**`find`** walks from a starting path and keeps paths that pass every test. **`+`** means more than and **`-`** means less than, for both size and age. Print the matches before you add **`-delete`** or **`-exec`**.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      {
        challengeId: 'linux-01-organize-the-release-folder',
        label: 'Organize the Release Folder',
      },
      {
        challengeId: 'linux-02-find-the-misplaced-configs',
        label: 'Find the Misplaced Configs',
      },
    ],
  },
  {
    id: 'reading-and-searching-text',
    slug: 'reading-and-searching-text',
    trackId: 'B2',
    eyebrow: '',
    title: 'Read, Edit and Search Text: less, tail, vi, grep',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-03-read-the-order-logs',
    lede:
      'Logs, configs, and scripts on a Linux server are all **plain text files**, and most of the work comes down to three jobs: **read** them, **edit** them, and **search** them. This post covers the tools for each — **`less`** and **`tail`** to read, **`vi`** and **`sed`** to edit, **`grep`** to search.',
    sections: [
      {
        id: 'viewing-overview',
        title: 'Read: look inside a text file',
        body: [
          'A text file can be a few lines, like a note or a config, or millions of lines, like a **log file** that a program keeps adding to. Linux has a small tool for each way of looking at it. The examples use **`file.txt`** — on a server it is often a log such as **`/var/log/app.log`**.',
        ],
        subsections: [
          {
            id: 'size-first',
            title: 'ls -lh and wc -l: check the size first',
            body: [
              'Before opening a file, find out how big it is. **`ls -lh`** shows the size in human units (**K**, **M**, **G**), and **`wc -l`** counts its lines. A 20-line file you can just print; a 2 GB log with ten million lines needs a different tool.',
            ],
            code: {
              language: 'shell',
              code: `ls -lh file.txt  # size, e.g. 2.1M
wc -l file.txt   # line count, e.g. 48213 file.txt`,
            },
          },
          {
            id: 'cat',
            title: 'cat: print the whole file',
            body: [
              '**`cat`** prints the entire file to the terminal in one go. That is perfect for short files like a config or a README.',
              'On a big file it is the wrong choice: thousands of lines scroll past faster than you can read, and you end up seeing only the last screenful.',
            ],
            code: {
              language: 'shell',
              code: `cat /etc/hostname  # a one-line file
cat notes.txt      # a short note`,
            },
          },
          {
            id: 'head-tail',
            title: 'head and tail: just the start or the end',
            body: [
              '**`head`** prints the first lines of a file and **`tail`** prints the last lines — 10 by default, or as many as you ask for with **`-n`**.',
              'Use **`head`** to see how a file starts (column names, the first events). Use **`tail`** for what happened **most recently** — new lines are added to the end of a log, so the latest events are always at the bottom.',
            ],
            code: {
              language: 'shell',
              code: `head file.txt        # first 10 lines
head -n 3 file.txt   # first 3 lines
tail file.txt        # last 10 lines
tail -n 50 file.txt  # last 50 lines`,
            },
          },
          {
            id: 'tail-f',
            title: 'tail -f: watch a file as it grows',
            body: [
              '**`tail -f`** (“follow”) prints the last lines and then **keeps waiting**: every time a program appends a new line, it appears on your screen straight away. This is how you watch a log live while you reproduce a problem.',
              'It never finishes on its own — press **Ctrl-C** to stop following and get your prompt back.',
            ],
            code: {
              language: 'shell',
              code: `tail -f /var/log/app.log         # print new lines as they arrive
tail -n 100 -f /var/log/app.log  # start with the last 100, then follow`,
            },
          },
          {
            id: 'less',
            title: 'less: scroll and search a big file',
            body: [
              '**`less`** opens a file in a scrollable window. It only reads the part you are looking at, so even a multi-gigabyte log opens instantly, and it never changes the file. When you are done, press **`q`** to quit back to the prompt.',
              '**Moving:** arrow keys go line by line, **Space** goes down a page and **`b`** goes back up a page. **`g`** jumps to the very start of the file and **`G`** to the very end.',
              '**Searching:** type **`/`** followed by a word and press Enter to search forward — every match is highlighted. **`n`** jumps to the next match and **`N`** to the previous one. **`?`** followed by a word searches backward.',
              '**Following:** press **`F`** to make **`less`** behave like **`tail -f`** and show new lines as they arrive. **Ctrl-C** stops following, so you can scroll back or search what just appeared.',
            ],
            code: {
              language: 'shell',
              code: `less file.txt             # open; q to quit
less -N file.txt          # show line numbers
less +G file.txt          # open at the end of the file
less +F /var/log/app.log  # open in follow mode`,
            },
          },
          {
            id: 'one-line',
            title: 'One exact line',
            body: [
              '**`head`** and **`tail`** give you a block of lines. They do not give you line 1500 by itself. **`sed -n \'1500p\'`** prints that one line and nothing else. **`-n`** stops sed from printing every line. **`p`** prints the line you named.',
              'In **`less`**, type the line number and then **`g`** to jump there. **`1500g`** lands on line 1500. **`less`** still only shows a window. It does not copy the file. **`head -n 1500 file.txt | tail -n 1`** is that same line: take the first 1500 lines, then keep the last one.',
            ],
            code: {
              language: 'shell',
              code: `sed -n '1500p' file.txt
less +1500 file.txt
head -n 1500 file.txt | tail -n 1`,
            },
          },
          {
            id: 'save-output',
            title: 'Save the lines you printed',
            body: [
              '**`>`** sends normal output into a file and replaces that file if it already exists. The command still runs. The lines go into the file instead of onto the screen. **`wc -l file.txt`** prints the count and then the file name. **`wc -l < file.txt`** feeds the file in as input, so the output is the number alone.',
            ],
            code: {
              language: 'shell',
              code: `wc -l < file.txt > count.txt
head -n 10 file.txt > start.txt
tail -n 5 file.txt > end.txt`,
            },
          },
        ],
        figure: {
          image: lessWindowImg,
          imageAlt:
            'Hand-drawn sketch: a tall log file with a small window over part of it. Space and b move the window. Slash searches, G jumps to the end, F follows new lines.',
          caption: 'less shows a window onto the file. It does not load the whole file, and it does not change it.',
          flush: true,
        },
        tableAfter: {
          headers: ['Tool', 'What it does', 'Use it when…'],
          rows: [
            ['`ls -lh` / `wc -l`', 'Shows size / counts lines', 'Before opening any file you do not know'],
            ['`cat`', 'Prints the **whole** file', 'The file is short (a note, a config)'],
            ['`head -n N`', 'First **N** lines', 'You want to see how the file starts'],
            ['`tail -n N`', 'Last **N** lines', 'You want the **latest** lines'],
            ['`tail -f`', 'Last lines, then **keeps printing** new ones', 'A program is still writing to the file, for example a log'],
            ['`less`', 'Scrollable, searchable window on the file', 'You need to read or hunt inside a big file'],
            ['`sed -n \'Np\'`', 'Exactly line N', 'You need one numbered line, not a block'],
            ['`>`', 'Saves normal output in a file', 'The answer should be a file, not only the screen'],
          ],
        },
      },
      {
        id: 'vim-survival',
        title: 'Edit: vi',
        body: [
          '**`vi`** is the text editor on almost every Linux machine. Typing **`vi`** usually starts **`vim`**, with the same keys. It edits notes, scripts, and configs, and it can open a file read-only with **`vi -R`** or **`view`**. **`vi newfile.txt`** starts an empty file. The file appears on disk when you save.',
        ],
        subsections: [
          {
            id: 'vi-modes',
            title: 'Two modes',
            body: [
              '**`vi`** starts in **Normal** mode. Keys are commands. **`j`** moves down, **`k`** moves up, and the arrow keys work too. Typing a letter does not insert that letter. If the cursor jumps when you type, you are still in Normal mode.',
              '**`i`** switches to **Insert** mode, where keys are text. **`a`** does the same, one character to the right. **Esc** returns to Normal mode. Almost every stuck moment in **`vi`** is “I am in the wrong mode.”',
            ],
          },
          {
            id: 'vi-insert-line',
            title: 'Add a line, save, or leave',
            body: [
              'In Normal mode, **`o`** opens a blank line under the cursor and switches to Insert mode. **`O`** opens a line above. That is how you add a setting that is not in the file yet. **`/`** then a word jumps to that word. **`n`** jumps to the next match. **`dd`** deletes the current line. **`u`** undoes.',
              '**`:wq`** writes the file and quits. **`:q!`** quits and throws away the changes. The colon means the command goes to the bottom of the screen, and it only works from Normal mode.',
            ],
            code: {
              language: 'text',
              code: `vi app.conf
/WELCOME
o
max_retries = 5
Esc
:wq`,
            },
          },
        ],
        figure: {
          image: viTwoModesImg,
          imageAlt:
            'Hand-drawn sketch: Normal mode on the left, where keys are commands, and Insert mode on the right, where keys are text. Esc returns to Normal. i or o enters Insert.',
          caption: 'Normal mode runs commands. Insert mode types text. Esc always gets you back.',
          flush: true,
        },
        tableAfter: {
          headers: ['Goal', 'Keys'],
          rows: [
            ['Move around', 'Arrow keys, or **`h j k l`**'],
            ['Start typing', '**`i`** before the cursor, **`a`** after it'],
            ['Open a new line', '**`o`** below, **`O`** above'],
            ['Back to Normal mode', '**Esc**'],
            ['Delete a line / undo', '**`dd`** / **`u`**'],
            ['Jump to a word', '**`/word`** then **`n`**'],
            ['Save and quit', '**`:wq`**'],
            ['Quit without saving', '**`:q!`**'],
          ],
        },
      },
      {
        id: 'sed-in-place',
        title: 'Edit: sed for one-line changes',
        body: [
          '**`sed`** edits every line of a text file with a small instruction, then prints the result. Use it when the change is the same on every line. Use **`vi`** when you have to look at the lines around the change, or insert one new line in the middle of a section.',
        ],
        subsections: [
          {
            id: 'sed-preview',
            title: 'Preview, then write',
            body: [
              '**`s/old/new/`** means replace **old** with **new**. Without **`-i`**, sed only prints the result. The file stays as it was. With **`-i`**, it writes the result back into the file. **`-i.bak`** also keeps a copy named **`file.bak`**.',
              'Run the command once without **`-i`** and read the output. Add **`-i`** only when that output is the file you want.',
            ],
            code: {
              language: 'shell',
              code: `sed 's/PORT=8080/PORT=9090/' app.conf
sed -i 's/PORT=8080/PORT=9090/' app.conf
sed -i.bak 's/LOG_LEVEL=info/LOG_LEVEL=debug/' app.conf`,
            },
          },
          {
            id: 'sed-global',
            title: 'Every match, and more than one edit',
            body: [
              '**`s/old/new/`** changes the first **old** on each line and leaves any later one on that line alone. A **`g`** at the end changes every **old** on the line: **`s/old/new/g`**.',
              '**`-e`** adds another instruction. Sed runs them in order on each line. One **`-e`** can replace text. The next can delete.',
              'In the pattern, a bare **`.`** means any one character. **`s/old.host/new.host/`** also changes **`oldXhost`**. Write **`\\.`** when you mean a real dot: **`s/old\\.host/new.host/g`**.',
            ],
            code: {
              language: 'shell',
              code: `sed 's/old\\.host/new.host/g' app.conf
sed -e 's/old\\.host/new.host/g' -e 's/debug/info/' app.conf`,
            },
          },
          {
            id: 'sed-delete',
            title: 'Delete a line, or uncomment one',
            body: [
              '**`/TODO/d`** deletes every line that contains **TODO**. **`^`** means the start of the line, so **`s/^# //`** removes a hash and a space from the front of a line and leaves the rest. That is how a commented setting becomes a real one.',
              'Sed still walks line by line. It will not open a blank line under a heading for you. That insert is the **`o`** key in **`vi`**.',
            ],
            code: {
              language: 'shell',
              code: `sed '/TODO/d' app.conf
sed 's/^# //' app.conf`,
            },
          },
        ],
        tableAfter: {
          headers: ['Use', 'When'],
          rows: [
            ['**`sed`** without **`-i`**', 'See the result before anything is written'],
            ['**`sed -i`**', 'The same replacement, or the same deletion, on many lines'],
            ['**`s/old/new/g`**', 'Every match on the line, not only the first'],
            ['**`\\.`**', 'A real dot. A bare `.` matches any one character'],
            ['**`vi`**', 'You need to read around the change, or insert one new line'],
          ],
        },
        callout: {
          kind: 'warn',
          title: 'Preview before -i',
          body: [
            'A wrong pattern with **`-i`** changes the real file immediately. Print the result first, then add **`-i`**.',
          ],
        },
      },
      {
        id: 'grep-basics',
        title: 'Search: grep',
        body: [
          '**`grep PATTERN FILE`** reads a text file line by line and prints only the lines that contain the pattern. It does not change the lines. It decides which ones survive.',
        ],
        subsections: [
          {
            id: 'grep-flags',
            title: 'Case, counts, and context',
            body: [
              '**`-i`** ignores upper and lower case, so **`error`** also matches **`ERROR`** and **`Error`**. **`-v`** prints the lines that do **not** match. **`-n`** adds the line number. **`-c`** does not print the lines. It prints how many lines matched.',
              '**`-A`**, **`-B`**, and **`-C`** keep a few lines after, before, or around each match, so you can see the setting next to the line you found. **`-r`** searches every file under a folder. **`-l`** prints only the names of the files that matched, not the lines.',
              'A line that starts with **`#`** is a comment. **`grep -v \'^#\'`** drops those lines, so a word that only appears in a comment does not count as a setting.',
            ],
            code: {
              language: 'shell',
              code: `grep -i error app.log
grep -c error app.log
grep -n 'user=ada' app.log
grep -v '^#' app.conf
grep -B2 -A2 retry app.log
grep -rl retry /etc/app/`,
            },
          },
          {
            id: 'grep-word',
            title: 'A whole word, not a longer code',
            body: [
              'Plain **`grep`** matches the letters anywhere. **`grep 12 app.log`** matches **`id=12`**, and it also matches **`id=123`** and **`id=12a`**, because those lines contain the characters **`12`**.',
              '**`-w`** requires a word edge on both sides. **`grep -w 12`** matches **`id=12`** and skips **`id=123`**. **`-c`** and **`-w`** combine: **`grep -cw 12 app.log`** counts the lines where **`12`** is a whole word. **`-c`** is the count. **`-w`** is the word edge.',
              '**`-o`** prints only the matched text, not the rest of the line. **`grep -oE \'id=[0-9]+\'`** prints each **`id=`** value on its own line. Pipe that list into **`sort | uniq`** when you want each value once. The pipes post covers that second half.',
            ],
            code: {
              language: 'shell',
              code: `grep 12 app.log
grep -w 12 app.log
grep -cw 12 app.log
grep -oE 'id=[0-9]+' app.log`,
            },
          },
        ],
        figure: {
          image: grepSieveImg,
          imageAlt:
            'Hand-drawn sieve: lines from a log fall through grep, and only the matching lines come out the bottom.',
          caption: 'Lines go in. Only the matching lines come out. The file is unchanged.',
          flush: true,
        },
        tableAfter: {
          headers: ['Option', 'What it does'],
          rows: [
            ['`-i`', 'Ignore upper and lower case'],
            ['`-v`', 'Lines that do **not** match'],
            ['`-c`', 'Count matching lines instead of printing them'],
            ['`-n`', 'Show line numbers'],
            ['`-w`', 'Whole word only, so `12` does not match `123`'],
            ['`-o`', 'Print only the matched text, not the whole line'],
            ['`-r`', 'Search every file under a folder'],
            ['`-l`', 'Print the name of each file that matched'],
            ['`-A` / `-B` / `-C` N', 'N lines after / before / around each match'],
            ['`-F`', 'Treat the pattern as plain text'],
          ],
        },
      },
      {
        id: 'regex-basics',
        title: 'Search: patterns with regex',
        body: [
          'Sometimes you are looking for a **shape** rather than a fixed word — “any 5xx error code” or “lines that start with today’s date.” A **regular expression** (regex) describes that shape. Use **`grep -E`** and put the pattern in **single quotes** so the shell leaves it alone.',
        ],
        figure: {
          image: readingARegexImg,
          imageAlt:
            'Hand-drawn sketch: a regex read left to right, each piece labeled as start of line, literal text, one or more letters, or end of line.',
          caption: 'Read a pattern from the left. Each piece matches one part of the line.',
          flush: true,
        },
        tableAfter: {
          headers: ['Piece', 'Meaning', 'Example'],
          rows: [
            ['`.`', 'Any one character', '`5.2` matches `502`, `512`'],
            ['`[0-9]`', 'One character from a set', '`code=5[0-9]`'],
            ['`+` / `*`', 'The previous item, one-or-more / zero-or-more times', '`[0-9]+` is a number'],
            ['`{n}`', 'The previous item, exactly n times', '`[0-9]{2}` is two digits'],
            ['`^` / `$`', 'Start / end of the line', '`^2026` is lines that start with 2026'],
            ['`a|b`', 'Either side', '`WARN|ERROR`'],
          ],
        },
        code: {
          language: 'shell',
          code: `grep -E 'WARN|ERROR' /var/log/app.log      # either word
grep -E '^2026-10-04' /var/log/app.log     # lines that start with that date
grep -E 'code=5[0-9]{2}' /var/log/app.log  # any 5xx code: 500, 502, 503…`,
        },
        callout: {
          kind: 'warn',
          title: 'Regex is not a glob',
          body: [
            'Globs like **`*.log`** are expanded by the **shell** to match **file names**. Regex is read by **`grep`** to match **text inside lines** — there **`*`** means “repeat the previous item,” not “anything.”',
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: [],
        tableAfter: {
          headers: ['Job', 'Goal', 'Command'],
          rows: [
            ['Read', 'Size of a file', '`ls -lh file`, `wc -l file`'],
            ['Read', 'Latest lines / watch live', '`tail -n 50 file`, `tail -f file`'],
            ['Read', 'Scroll and search', '`less file`, then `/text`'],
            ['Read', 'Exactly line 1500', "`sed -n '1500p' file`"],
            ['Edit', 'Insert a line and save', '`vi file` → `/word` → `o` → **Esc** → `:wq`'],
            ['Edit', 'Replace every match', "`sed -i 's/old/new/g' file`"],
            ['Edit', 'Delete matching lines', "`sed '/TODO/d' file`"],
            ['Search', 'Count a whole word', '`grep -cw 12 file`'],
            ['Search', 'Only the matched text', "`grep -oE 'id=[0-9]+' file`"],
            ['Search', 'Matching lines', '`grep -n pattern file`'],
            ['Search', 'Search a folder', '`grep -r pattern dir/`'],
          ],
        },
      },
    ],
    takeaways: [
      '**Read**: size a file with **`ls -lh`** and **`wc -l`**. Use **`less`** for a big file, **`tail -f`** to watch it grow, and **`sed -n \'Np\'`** for one exact line.',
      '**Edit**: **`vi`** has Normal mode and Insert mode. **`o`** opens a new line. **`:wq`** saves. **`sed`** replaces or deletes lines. **`g`** means every match on the line. Preview before **`-i`**.',
      '**Search**: **`grep`** keeps matching lines. **`-c`** counts them. **`-w`** requires a whole word, so **`12`** does not match **`123`**. **`-o`** prints only the match. **`-E`** matches a shape.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      {
        challengeId: 'linux-03-read-the-order-logs',
        label: 'Read the Order Logs',
      },
      {
        challengeId: 'linux-04-grep-the-failed-payments',
        label: 'The Failed Payment Spike',
      },
      {
        challengeId: 'linux-06-fix-the-config-with-sed-and-vim',
        label: 'Point Orders at the New Queue',
      },
    ],
  },
  ...LINUX_READINGS_EXTENDED,
];

/** Old slugs of readings that were merged into another post. */
const LINUX_READING_ALIASES: Record<string, string> = {
  'edit-configs-with-sed-and-vim': 'reading-and-searching-text',
};

export function getLinuxReading(slug: string | null | undefined): K8sReading | null {
  if (!slug) return null;
  const target = LINUX_READING_ALIASES[slug] ?? slug;
  return LINUX_READINGS.find((r) => r.slug === target || r.id === target) || null;
}

/** Readings inserted at the start of the Linux track (before lab 0). */
const LINUX_READINGS_BEFORE_LABS = ['meet-your-linux-machine'] as const;

/** Readings inserted immediately after a given challenge id. */
const LINUX_READINGS_AFTER_CHALLENGE: Record<string, string[]> = {
  'linux-00-first-shift-on-the-order-box': ['files-and-folders'],
  'linux-02-find-the-misplaced-configs': ['reading-and-searching-text'],
  'linux-04-grep-the-failed-payments': ['pipes-and-pipelines'],
  'linux-09-shared-drop-folder-for-notifications': ['users-groups-and-permissions'],
  'linux-10-hunt-the-runaway-process': ['processes-and-signals'],
  'linux-11-keep-the-batch-running-after-logout': ['background-jobs-and-nohup'],
  'linux-14-debug-a-failing-unit': ['systemd-and-journalctl'],
  'linux-16-rotate-notification-logs': ['cron-and-log-rotation', 'packages-and-pinning'],
  'linux-19-archive-and-roll-back-releases': ['storage-df-du-and-archives'],
  'linux-20-why-cant-order-reach-payment': ['networking-basics', 'ssh-keys-and-login'],
  'linux-24-loop-over-order-batches': ['bash-scripting-basics'],
};

/** Ordered mixed roadmap for the DevOps Linux panel: readings + challenges. */
export function listLinuxTrackItems(): K8sTrackItem[] {
  const panel = PLAY_DOMAINS.find((d) => d.id === 'devops-engineer')?.panels.find(
    (p) => p.id === 'linux',
  );
  const items: K8sTrackItem[] = LINUX_READINGS_BEFORE_LABS.map((readingId) => ({
    type: 'reading',
    id: `reading:${readingId}`,
    readingId,
  }));
  for (const challengeId of panel?.challengeIds ?? []) {
    items.push({ type: 'challenge', id: `challenge:${challengeId}`, challengeId });
    for (const readingId of LINUX_READINGS_AFTER_CHALLENGE[challengeId] ?? []) {
      items.push({ type: 'reading', id: `reading:${readingId}`, readingId });
    }
  }
  return items;
}
