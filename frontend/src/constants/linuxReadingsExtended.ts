/** Linux track readings B3–B13 (labs 05+). Each post stands alone with its own story. */

import type { K8sReading } from './k8sReadings';
import groupsOnOneUserImg from '../assets/linux-readings/users-groups-and-permissions/groups-on-one-user.png';
import whichBitsApplyImg from '../assets/linux-readings/users-groups-and-permissions/which-bits-apply.png';
import pipeLeftToRightImg from '../assets/linux-readings/pipes-and-pipelines/pipe-left-to-right.png';

export const LINUX_READINGS_EXTENDED: K8sReading[] = [
  {
    id: 'pipes-and-pipelines',
    slug: 'pipes-and-pipelines',
    trackId: 'B3',
    eyebrow: '',
    title: 'Pipes and Pipelines: sort, uniq, wc, cut, awk',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-05-pipeline-for-the-daily-order-report',
    lede:
      'When a file has thousands of lines, you still need **totals**, **top sellers**, and **counts** — not eye strain. This post uses a **camp snack store** ledger to show **pipes**: small tools wired with **`|`** so the computer does the scrolling.',
    sections: [
      {
        id: 'camp-snack-story',
        title: 'Camp snack store',
        body: [
          'A **summer camp** runs a small **snack store** — a hut beside the dining hall where campers buy **drinks, granola bars, and fruit cups** (not clothes or gear). You volunteer on the desk. Each purchase is logged on a **Linux PC** in the camp office.',
          'Every sale appends one line to **`snacks.csv`**: date, cabin, snack name, **successful** or **failed**, and price in cents. By mid-morning the file already has thousands of lines.',
          'The director bets you a tray of ice bars if you can name the **top three best-selling snacks** (successful sales only) before the lunch rush. You will not read every row by hand — you **chain** commands: keep successful rows, grab the snack column, **sort**, **count**, show the top three.',
        ],
        code: {
          language: 'csv',
          filename: 'snacks.csv',
          code: `date,cabin,snack,status,cents
2026-07-04,Pine-7,Iced tea,successful,150
2026-07-04,Maple-2,Granola bar,successful,200
2026-07-04,Pine-7,Granola bar,successful,200
2026-07-04,Oak-1,Iced tea,failed,150`,
        },
      },
      {
        id: 'manual-vs-tools',
        title: 'Why not just read the whole file?',
        body: [
          'One approach is to open **`snacks.csv`** in an editor or **`less`**, scan line by line, and keep a tally in your head — or copy rows into a spreadsheet — to compute **top sellers**, **failed-sale counts**, or **total cents** for the day.',
          'That works for twenty lines. It falls apart at twenty **thousand**. You miscount when a camper buys two granola bars in a row, you forget to skip the failed ones, and you lose an hour you do not have before lunch.',
          'What you really want is to hand the boring part to the computer: **throw away** rows you do not care about, **keep** just the column you need, then **count** or **add up** what is left. Linux has small tools for each of those steps, plus a simple way to **connect** them. The next two sections cover both.',
        ],
        table: {
          headers: ['Question about the ledger', 'Doing it by hand'],
          rows: [
            ['Top 3 snacks (successful only)', 'Scroll, skip failed sales, tally every snack name'],
            ['How many sales failed today?', 'Count failed rows while scrolling'],
            ['Total cents from successful sales', 'Copy the cents column into a spreadsheet and add it up'],
          ],
        },
      },
      {
        id: 'pipe-mechanics',
        title: 'What is a pipe?',
        body: [
          'A **pipe** is the **`|`** between two commands. The normal output of the left command becomes the input of the right one. You do not need a temporary file.',
          'Only **stdout** flows through. **stderr**, the error stream, still prints on your screen. A typo in the first command shows up even when the rest of the pipe prints nothing. Read a pipeline from the left. Each command does one job.',
        ],
        figure: {
          image: pipeLeftToRightImg,
          imageAlt:
            'Hand-drawn sketch: grep passes its output to cut, and cut passes its output to sort. Errors point down and stay on the screen.',
          caption: 'Normal output moves to the next command. Errors stay on the screen.',
          flush: true,
        },
        tableAfter: {
          headers: ['Piece', 'Meaning'],
          rows: [
            ['`|`', 'Send the left command’s output into the right command'],
            ['stdout', 'Normal output — flows through the pipe'],
            ['stdin', 'Where the right-hand command reads from'],
            ['stderr', 'Errors — stays on the screen'],
          ],
        },
      },
      {
        id: 'redirection',
        title: 'Send output to a file',
        body: [
          'A pipe connects two commands. A redirection connects a command to a file. **`>`** sends stdout into a file and replaces whatever was in that file. **`>>`** adds to the end instead. **`2>`** sends stderr into a file. The **`2`** is the error stream.',
          'A program can write both streams at once. **`command > results.txt 2> warnings.txt`** puts the normal lines in one file and the warnings in another. Leave off the **`2>`** and the warnings stay mixed into your terminal, or into the same file if you only used **`>`**.',
        ],
        code: {
          language: 'shell',
          code: `grep ',successful,' snacks.csv > ok.csv
grep ',successful,' snacks.csv >> ok.csv
command > results.txt 2> warnings.txt`,
        },
        tableAfter: {
          headers: ['Symbol', 'What it does'],
          rows: [
            ['`>`', 'Normal output into a file. Replaces the file'],
            ['`>>`', 'Normal output added to the end of a file'],
            ['`2>`', 'Errors into a file. The `2` is the error stream'],
            ['`<`', 'A file fed in as input, so the command is not given a file name'],
          ],
        },
      },
      {
        id: 'question-to-pipeline',
        title: 'From the director’s question to one command',
        body: [
          '**“Which three snacks sold the most today — successful sales only?”** Each step you would do by hand has a tool:',
        ],
        bullets: [
          'Keep only the successful lines → **`grep`**',
          'Look only at the snack name → **`cut`**',
          'Group identical names together → **`sort`**',
          'Count each group → **`uniq -c`**',
          'Rank biggest first → **`sort -rn`**',
          'Take the top three → **`head`**',
        ],
        codes: [
          {
            language: 'shell',
            code: `grep ',successful,' snacks.csv | cut -d, -f3 | sort | uniq -c | sort -rn | head -3`,
          },
        ],
        after: [
          'Same six steps, joined with **`|`**. The next section looks at each tool on its own.',
        ],
      },
      {
        id: 'filter-tools',
        title: 'Filters: tools that fit in a pipe',
        body: [
          'A **filter** is a command that reads **text in**, changes it, and prints **text out** — which is exactly what a pipe needs. Most filters accept a **file name**, but when they sit on the right side of **`|`** they read from stdin instead. Here are the ones from the snack pipe, in the order they ran.',
        ],
        subsections: [
          {
            id: 'grep',
            title: 'grep: keep the lines you want',
            body: [
              '**`grep`** prints every line that contains a pattern and silently drops the rest. It does not change the lines — it only decides which ones survive.',
              'Include the commas around **`successful`** so it only matches the status column, not a snack that happens to contain the word. **`-v`** flips the match; **`-i`** ignores upper/lower case.',
            ],
            code: {
              language: 'shell',
              code: `# Keep successful sales (drops failed ones and the header)
grep ',successful,' snacks.csv

# Everything except failed sales
grep -v ',failed,' snacks.csv`,
            },
          },
          {
            id: 'cut',
            title: 'cut: keep the columns you want',
            body: [
              '**`cut`** works on each line separately. **`-d,`** says columns are separated by commas, and **`-f`** picks which columns to print.',
              'It is simple: it does not understand quoted CSV fields with commas inside them, so it fits clean files like this ledger best.',
            ],
            code: {
              language: 'shell',
              code: `# Snack name only (column 3)
cut -d, -f3 snacks.csv

# Cabin and snack (columns 2 and 3)
cut -d, -f2,3 snacks.csv`,
            },
          },
          {
            id: 'sort',
            title: 'sort: put lines in order',
            body: [
              '**`sort`** prints its input lines back in order — alphabetical by default. In the snack pipe its real job is **grouping**: after sorting, identical names sit next to each other.',
              '**`-n`** sorts by number (so 10 comes after 9, not after 1), **`-r`** reverses the order, and **`-u`** drops duplicates.',
            ],
            code: {
              language: 'shell',
              code: `# Alphabetical snack names
cut -d, -f3 snacks.csv | sort

# Unique snack names
cut -d, -f3 snacks.csv | sort -u

# Numbers, biggest first
sort -rn`,
            },
          },
          {
            id: 'uniq',
            title: 'uniq: collapse and count repeats',
            body: [
              '**`uniq`** merges **neighbouring** identical lines into one. With **`-c`** it writes how many there were in front, so three Granola bar lines in a row become one line with a 3.',
              'It only compares a line with the one right above it, so duplicates far apart are counted separately. That is why **`sort`** always comes right before **`uniq -c`**.',
            ],
            code: {
              language: 'shell',
              code: `# Count each snack (sort first so duplicates touch)
cut -d, -f3 snacks.csv | sort | uniq -c`,
            },
          },
          {
            id: 'head',
            title: 'head: keep only the first few lines',
            body: [
              '**`head`** prints the first few lines and stops — ten by default, or as many as you ask with **`-N`**. Its partner **`tail`** prints the last few instead.',
              'It is also handy while building a pipe: put it at the end to peek at a sample instead of thousands of lines.',
            ],
            code: {
              language: 'shell',
              code: `# First 3 lines of a ranked list
... | sort -rn | head -3

# Peek at the first 10 lines of the ledger
head snacks.csv`,
            },
          },
          {
            id: 'wc-and-awk',
            title: 'wc counts lines, awk can add',
            body: [
              '**`wc -l`** counts lines. Put it at the end of a pipe when the question is “how many?”.',
              '**`awk`** splits each line into fields and can do arithmetic. **`-F,`** says the fields are separated by commas. **`$1`** is the first field, **`$4`** the fourth, **`$5`** the fifth. **`NR`** is the line number, starting at 1, so **`NR>1`** skips a header row. The **`{sum += $5}`** block runs on every line that passed the test. **`END {print sum}`** runs once, after the last line, and prints the total.',
            ],
            code: {
              language: 'shell',
              code: `# How many failed sales?
grep ',failed,' snacks.csv | wc -l

# Total cents from successful sales
awk -F, 'NR>1 && $4=="successful" {sum += $5} END {print sum}' snacks.csv`,
            },
          },
        ],
        callout: {
          kind: 'tip',
          title: 'Debug a pipeline from the left',
          body: [
            'Run only the first command. Add **`| head`** after each new stage so you see a **sample** before the full result flies by. Fix **`grep`** before you blame **`uniq`**. ',
          ],
        },
      },
      {
        id: 'win-the-bet',
        title: 'Win the bet: top three snacks',
        body: [
          'Now go back to the three questions from earlier. Each one becomes a single command line built from the pipe and filters above.',
          'Columns in **`snacks.csv`**: **`date`**, **`cabin`**, **`snack`**, **`status`**, **`cents`**. For the top three: successful rows only, then snack names, sort so duplicates touch, count, sort by count, take three.',
        ],
        table: {
          headers: ['Question about the ledger', 'Doing it by hand', 'Pipeline'],
          rows: [
            ['Top 3 snacks (successful only)', 'Scroll and tally', '`grep` → `cut` → `sort` → `uniq -c` → `sort -rn` → `head`'],
            ['How many sales failed today?', 'Count while scrolling', '`grep failed | wc -l`'],
            ['Total cents from successful sales', 'Add in a spreadsheet', '`awk` sum on the cents column'],
          ],
        },
        code: {
          language: 'shell',
          code: `# Preview successful rows
grep ',successful,' snacks.csv | head

# Top 3 snacks
grep ',successful,' snacks.csv | cut -d, -f3 | sort | uniq -c | sort -rn | head -3

# Failed sale count
grep ',failed,' snacks.csv | wc -l

# Total cents from successful sales (awk reads the file directly)
awk -F, 'NR>1 && $4=="successful" {sum += $5} END {print sum}' snacks.csv`,
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: [
          'Match the **question** to a **shape**: narrow lines → transform columns → order → count → trim. Sums often live in **`awk`** without a long pipe.',
        ],
        tableAfter: {
          headers: ['Goal', 'Shape of the pipeline'],
          rows: [
            ['Count matching lines', '`grep pattern file | wc -l`'],
            ['Unique values', '`cut ... | sort -u`'],
            ['Top N counts', "`grep ... | cut ... | sort | uniq -c | sort -rn | head -N`"],
            ['Sum a numeric column', '`awk -F, \'NR>1 {sum+=$5} END {print sum}\' file`'],
            ['Normal output in one file, errors in another', '`command > results.txt 2> warnings.txt`'],
          ],
        },
      },
    ],
    takeaways: [
      'Scrolling huge logs to compute **top N**, **counts**, or **sums** is slow and error-prone — use **filters** instead.',
      '**`|`** connects **stdout → stdin**; read pipelines **left to right**, one job per command.',
      '**`grep`** narrows lines; **`cut`** picks columns; **`sort`** + **`uniq -c`** count repeats; **`head`** / **`wc -l`** finish the answer.',
      '**`awk`** names fields **`$1`**, **`$2`**, and adds them up in **`END`**. **`>`** and **`2>`** save normal output and errors in different files. Debug from the left, and add **`| head`**.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      {
        challengeId: 'linux-05-pipeline-for-the-daily-order-report',
        label: 'Pipeline for the Daily Order Report',
      },
    ],
  },
  {
    id: 'users-groups-and-permissions',
    slug: 'users-groups-and-permissions',
    trackId: 'B4',
    eyebrow: '',
    title: 'Users, Groups, and Permissions',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-07-onboard-the-payments-team',
    lede:
      'Monday on a shared box. **Ravi** needs a login and a way to restart one service, the app’s signing key is readable by every account, **Leela** must read a team folder without joining the team, and **Meera**’s old login still works.',
    sections: [
      {
        id: 'who-is-on-the-box',
        title: 'Who is on the box',
        body: [
          'Asha is already here. The app runs as **app**, a user of its own, so it is not running as Asha and not as you. A **group** is a named list of users. Grant access to the group once, and everyone in it gets that access. **developers** is the list for this team.',
          'Asha’s **primary group** is **asha**. **developers** is an **extra group**. **app**’s primary group is **developers**. A login can be in many groups. A file still has one owner and one group.',
        ],
        subsections: [
          {
            id: 'whoami-id',
            title: 'whoami and id',
            body: [
              '**`whoami`** prints the user running the command. **`id`** prints the numbers Linux checks: the user id (**uid**), the primary group id (**gid**), and every group. Names are labels. Permission checks use the numbers.',
              '**`gid=`** is the primary group. **`groups=`** lists every group, and the primary group is in that list too. **`id asha`** looks up Asha. **`id app`** looks up the service account.',
            ],
            code: {
              language: 'shell',
              code: `whoami
id asha
# uid=1001(asha) gid=1001(asha) groups=1001(asha),4(adm),1002(developers)
id app
# uid=999(app) gid=1002(developers) groups=1002(developers)`,
            },
          },
          {
            id: 'passwd-group-files',
            title: 'Where those lines are written',
            body: [
              'Accounts live in two text files. Anyone can read them. Only root can change them. **`getent`** prints one line, and it still works when the account comes from a company directory instead of these files.',
              '**`x`** means the password hash is in **`/etc/shadow`**, which only root can read. **app**’s shell is **`/usr/sbin/nologin`**, so a login session refuses to start. That is a service account. Run a command as app with **`sudo -u app`**. There is no login to sign in to.',
              'The **developers** line lists extra members. **app** is not written there, and app is still in the group: **developers** is app’s primary group, the gid on app’s passwd line.',
            ],
            code: {
              language: 'shell',
              code: `getent passwd asha
# asha:x:1001:1001:Asha Rao:/home/asha:/bin/bash
getent passwd app
# app:x:999:1002:app:/opt/app:/usr/sbin/nologin
getent group developers
# developers:x:1002:asha`,
            },
          },
        ],
        table: {
          headers: ['Field', 'Asha’s line', 'What it is'],
          rows: [
            ['login', '`asha`', 'The name typed at a prompt'],
            ['password', '`x`', 'The hash is in `/etc/shadow`, readable by root'],
            ['uid', '`1001`', 'The user number Linux checks'],
            ['gid', '`1001`', 'Her primary group'],
            ['comment', '`Asha Rao`', 'Usually the person’s name'],
            ['home', '`/home/asha`', 'Where a login starts'],
            ['shell', '`/bin/bash`', 'Program started at login. `app` has `/usr/sbin/nologin`'],
          ],
        },
        figure: {
          image: groupsOnOneUserImg,
          imageAlt:
            'Hand-drawn sketch: one login has a primary group from /etc/passwd and an extra group named team. adm and sudo are already on the box.',
          caption:
            'The primary group comes from the user record. Extra groups are added. adm and sudo are already on the box.',
          flush: true,
        },
        after: [
          '**`adm`** and **`sudo`** are already on the box. **`adm`** can read system logs under **`/var/log`**, such as **`syslog`** and **`auth.log`**. The **`sudo`** group can run any command as root. Ravi will need **`adm`**. He does not get **`sudo`**.',
        ],
        tableAfter: {
          headers: ['Field', '`developers:x:1002:asha`', 'What it is'],
          rows: [
            ['name', '`developers`', 'The group'],
            ['password', '`x`', 'Unused on a normal group'],
            ['gid', '`1002`', 'The same number as app’s gid in `/etc/passwd`'],
            ['members', '`asha`', 'Extra members only. app is in the group because its passwd gid is 1002'],
          ],
        },
      },
      {
        id: 'give-a-login',
        title: 'Give Ravi a login, and close Meera’s',
        body: [
          'Ravi needs a home directory, the bash shell, and the **developers** group. Meera left last week. Her files stay. Her login has to stop.',
        ],
        subsections: [
          {
            id: 'useradd',
            title: 'Create the group and the user',
            body: [
              '**`groupadd`** adds an empty group. On this box **developers** is already there, with Asha in it, so Ravi only needs a user. **`useradd`** adds one line to **`/etc/passwd`**. On its own that is often a bare account: no home directory, and no password, so the person cannot log in.',
              '**`-m`** creates **`/home/ravi`** and gives it to him. **`-s /bin/bash`** sets the shell. **`-c`** sets the comment. **`-G`** adds extra groups and leaves his primary group as **ravi**, a group created with the account. **`passwd`** sets a password so he can log in.',
              '**`groupadd -g`** picks the gid yourself, which matters when two machines must agree on the number. **`groupdel`** removes a group nobody is in.',
            ],
            code: {
              language: 'shell',
              code: `sudo groupadd developers
sudo useradd -m -s /bin/bash -c 'Ravi Kumar' -G developers ravi
sudo passwd ravi
id ravi
# uid=1003(ravi) gid=1003(ravi) groups=1003(ravi),1002(developers)`,
            },
          },
          {
            id: 'retire',
            title: 'Close Meera’s login',
            body: [
              'Two changes, and **`/home/meera`** stays. **`-L`** locks the password, so a password login fails. **`-s /usr/sbin/nologin`** sets a shell that will not start a session. **`passwd -S`** prints the state. The second field is **`L`** when the password is locked.',
              '**`userdel -r meera`** is the other choice. It deletes the account and the home directory.',
            ],
            code: {
              language: 'shell',
              code: `sudo usermod -L -s /usr/sbin/nologin meera
sudo passwd -S meera
# meera L ...`,
            },
          },
          {
            id: 'usermod-ag',
            title: 'Add a group later',
            body: [
              'Ravi reads logs, so he also joins **`adm`**. Adding a group is **`-aG`**. **`-a`** means append.',
              '**`id ravi`** reads the account files, so **`adm`** shows up immediately. A shell Ravi already has open keeps the groups from when it started, and access checks use those. **`sudo -u ravi id`** starts a new command as Ravi and picks up the groups he has now. When the shell that is stale is your own, **`sg developers -c \'id\'`** runs one command with a group you belong to.',
              '**`gpasswd -d ravi adm`** removes him from **`adm`** and leaves his other groups alone.',
            ],
            code: {
              language: 'shell',
              code: `sudo usermod -aG adm ravi
id ravi
# groups include developers and adm
sudo -u ravi id`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: '-G replaces the extra groups',
          body: [
            '**`usermod -G developers ravi`** sets his extra groups to that list and nothing else. If he was in **`sudo`** or **`adm`**, he is out of them. **`-aG`** is the form that adds a group.',
          ],
        },
      },
      {
        id: 'restart-one-service',
        title: 'Restart one service',
        body: [
          'When **app** dies, Ravi has to start it again and see whether it is running. Those are the only commands he may run as root. The **`sudo`** group would let him run every command. He stays out of it. One file under **`/etc/sudoers.d/`** names the two commands for the whole **developers** group.',
        ],
        subsections: [
          {
            id: 'sudo-group',
            title: 'The sudo group is every command',
            body: [
              'On Ubuntu, members of **`sudo`** may run any command as root. **`sudo -l`** prints the rules that apply to you. A person who may restart one service does not belong in this group.',
            ],
            code: {
              language: 'shell',
              code: `getent group sudo
# sudo:x:27:learner
sudo -l`,
            },
          },
          {
            id: 'sudoers-line',
            title: 'Two commands, for the whole group',
            body: [
              'Rules live in **`/etc/sudoers`** and in small files under **`/etc/sudoers.d/`**. One file per team stays readable. A name that starts with **`%`** is a group. Write each command as a full path, because sudo matches the path. A command that is not on the line is refused.',
              'Open the file with **`visudo -f`**. visudo will not save a broken line. Then the file has to be owned by **`root:root`**, mode **`440`**, and **`visudo -cf`** has to accept it.',
            ],
            code: {
              language: 'text',
              filename: '/etc/sudoers.d/developers',
              code: `%developers ALL=(root) NOPASSWD: /usr/bin/systemctl restart app, /usr/bin/systemctl status app`,
            },
          },
        ],
        table: {
          headers: ['Piece of the line', 'Meaning'],
          rows: [
            ['`%developers`', 'The group, not a user named developers'],
            ['`ALL`', 'Any machine this file is copied to'],
            ['`(root)`', 'Run the command as root'],
            ['`NOPASSWD:`', 'Do not ask for a password'],
            ['the two paths', 'Only these commands. Each one is a full path, separated by a comma'],
          ],
        },
        code: {
          language: 'shell',
          code: `sudo visudo -f /etc/sudoers.d/developers
sudo chown root:root /etc/sudoers.d/developers
sudo chmod 440 /etc/sudoers.d/developers
sudo visudo -cf /etc/sudoers.d/developers`,
        },
        callout: {
          kind: 'warn',
          title: 'sudo ignores a loose file',
          body: [
            '**`root:root`** has to own the file, in mode **`440`**. Leave it at **`644`** and sudo skips the file: the rule never applies. **`visudo -cf`** checks the grammar. It does not check the owner or the mode.',
          ],
        },
      },
      {
        id: 'read-ls',
        title: 'Read one ls -l line',
        body: [
          '**`secret.env`** is the file to practice on. **`ls -l`** prints its owner, its group, and nine letters. Linux picks one trio and stops: the owner, else someone in the file’s group, else everyone else.',
        ],
        subsections: [
          {
            id: 'ls-line',
            title: 'One line of ls -l',
            body: [
              '**`ls -l`** prints one line per file: type, permissions, owner, group, size, and date. **`ls -ld`** prints the directory itself. Without **`-d`**, **`ls -l`** on a directory lists what is inside.',
              'The first character is the type: **`-`** a file, **`d`** a directory, **`l`** a link. The next nine characters are three trios, owner then group then others. Inside a trio the order is always read, write, execute. A letter is allowed. A dash is not. Here **app** is the owner and **developers** is the group. app’s trio is **`rw-`**. The group’s trio is **`r--`**. Everyone else’s trio is **`---`**.',
            ],
            code: {
              language: 'shell',
              code: `ls -l /etc/app/secret.env
# -rw-r----- 1 app developers 180 Oct  4 09:15 /etc/app/secret.env`,
            },
          },
          {
            id: 'which-trio',
            title: 'Which three letters count',
            body: [
              'Linux asks three questions, in order, and stops at the first yes.',
              'Are you the **owner**? Then only the owner trio counts. The group trio does not add rights. If the owner trio is **`r--`** and the group trio is **`rwx`**, the owner can still only read.',
              'If you are not the owner, are you in the file’s **group**? Then only the group trio counts. Ravi is in **developers** and does not own **`secret.env`**, so he gets **`r--`**.',
              'Otherwise you are **others**, and only the last trio counts.',
              'On a directory the letters mean something else, because a directory is a list of names. **`r`** without **`x`** lists names you cannot open. **`x`** without **`r`** opens a file whose name you already know, and **`ls`** fails. A directory people can use has **`x`** next to **`r`**.',
            ],
          },
        ],
        table: {
          headers: ['Letter', 'Value', 'On a file', 'On a directory'],
          rows: [
            ['`r`', '4', 'Read the contents', 'List the names inside'],
            ['`w`', '2', 'Change the contents', 'Create, rename, or delete names'],
            ['`x`', '1', 'Run it as a program', 'Enter it and open a file inside'],
          ],
        },
        figure: {
          image: whichBitsApplyImg,
          imageAlt:
            'Hand-drawn sketch: the owner gets rw-, someone in the group gets r--, and everyone else gets ---. Linux uses only one of those sets.',
          caption: 'Linux picks one set. Owner first, then the group, then everyone else.',
          flush: true,
        },
        after: [
          'Each letter is a number: **`r`** is 4, **`w`** is 2, **`x`** is 1. Add one trio to get a digit from 0 to 7. **`rw-r-----`** is 6, 4, 0, so the mode is **`640`**. **`stat -c \'%a\' file`** prints that number.',
        ],
        tableAfter: {
          headers: ['Number', 'Letters', 'Use it for'],
          rows: [
            ['`644`', '`rw-r--r--`', 'A normal file. Anyone can read it'],
            ['`640`', '`rw-r-----`', 'The group can read. Others cannot'],
            ['`600`', '`rw-------`', 'A key. The owner only'],
            ['`755`', '`rwxr-xr-x`', 'A program, or a directory anyone can enter'],
            ['`750`', '`rwxr-x---`', 'A directory the group can enter'],
            ['`770`', '`rwxrwx---`', 'A directory for the owner and the group'],
          ],
        },
      },
      {
        id: 'who-owns-the-files',
        title: 'Who should own the files',
        body: [
          'The app’s files were left open: every account could read the signing key, and change it. Two owners, on purpose.',
          '**root** owns the settings directory, the config, and the rotation program. An admin is who changes those. **app** must not rewrite them.',
          '**app** owns the secret, the signing key, and the logs, because the service has to write them. Mode **`600`** on the key leaves even **developers** out. **app** can still read it, because **app** is the owner.',
          '**app**’s primary group is **developers**, so the group letters apply to **app** on the files root owns. **app** can read the config. **app** cannot change it.',
        ],
        table: {
          headers: ['Path', 'Owner:group', 'Mode', 'What that is for'],
          rows: [
            ['`/etc/app`', '`root:developers`', '`750`', 'The group can list and enter'],
            ['`/etc/app/app.conf`', '`root:developers`', '`640`', 'The group can read. root can change it'],
            ['`/etc/app/secret.env`', '`app:developers`', '`640`', 'app can change it. The group can read'],
            ['`/etc/app/signing.key`', '`app:developers`', '`600`', 'Only app'],
            ['`/opt/app/bin/rotate.sh`', '`root:developers`', '`750`', 'The group can run it. root can change it'],
            ['`/var/log/app`', '`app:developers`', '`750`', 'app writes logs. The group can list'],
            ['`/var/log/app/app.log`', '`app:developers`', '`640`', 'The group can read the log'],
          ],
        },
        codes: [
          {
            language: 'shell',
            code: `sudo chown root:developers /etc/app /etc/app/app.conf /opt/app/bin/rotate.sh
sudo chown app:developers /etc/app/secret.env /etc/app/signing.key /var/log/app /var/log/app/app.log
sudo chmod 750 /etc/app /opt/app/bin/rotate.sh /var/log/app
sudo chmod 640 /etc/app/app.conf /etc/app/secret.env /var/log/app/app.log
sudo chmod 600 /etc/app/signing.key`,
          },
        ],
        after: [
          'The owner of a file can change its mode. Giving the file to another user takes root. **`chown user:group file`** sets both. **`chgrp developers file`** changes the group only, which you can do without root when you own the file and you are in the new group.',
          '**`chmod 640`** sets all nine letters. **`chmod g+w file`** adds one letter and leaves the rest. **`u`** is the owner, **`g`** the group, **`o`** others, **`a`** all three. **`+`** adds, **`-`** removes, **`=`** sets that trio to exactly those letters.',
          'Then check as the accounts that have to live with it. **`sudo -u`** runs one command as that user, with the groups they have now.',
        ],
        code: {
          language: 'shell',
          code: `sudo -u app cat /etc/app/app.conf
sudo -u app cat /etc/app/signing.key
sudo -u ravi cat /etc/app/secret.env
sudo -u ravi cat /etc/app/signing.key
# Permission denied
sudo -u nobody ls /etc/app
# Permission denied`,
        },
        callout: {
          kind: 'warn',
          title: 'chmod -R uses one mode for everything',
          body: [
            '**`chmod -R`** walks into the directory and sets the same letters on every file and every folder. A folder needs **`x`** so people can enter. A key should not be executable. Set the mode on each path.',
          ],
        },
      },
      {
        id: 'shared-folder',
        title: 'A folder the team shares',
        body: [
          '**`/srv/team`** is where Asha and Ravi drop files for each other. Mode **`770`** lets the group work there and keeps everyone else out. The group of a new file, and who may delete a name, are still wrong.',
        ],
        subsections: [
          {
            id: 'setgid',
            title: 'New files take the creator’s group',
            body: [
              'Asha creates **`draft.txt`**. The directory’s group is **developers**. The file’s group is **asha**, her primary group. Ravi is not in group **asha**, so he is “others” on that file. **`umask 007`** turns off every bit for others, so he cannot read it.',
              '**setgid** on the directory fixes the group. **`chmod 2770`** is setgid plus **`770`**. A new file inherits the directory’s group. In **`ls -l`** the group’s **`x`** shows as **`s`**.',
            ],
            code: {
              language: 'shell',
              code: `sudo mkdir -p /srv/team
sudo chgrp developers /srv/team
sudo chmod 770 /srv/team
sudo -u asha sh -c 'umask 007; touch /srv/team/draft.txt'
ls -l /srv/team/draft.txt
# -rw-rw---- 1 asha asha ... draft.txt
sudo -u ravi cat /srv/team/draft.txt
# Permission denied

sudo chmod 2770 /srv/team
sudo -u asha sh -c 'umask 007; touch /srv/team/notes.txt'
ls -ld /srv/team
# drwxrws--- root developers /srv/team
ls -l /srv/team/notes.txt
# -rw-rw---- 1 asha developers ... notes.txt
sudo -u ravi cat /srv/team/notes.txt`,
            },
          },
          {
            id: 'sticky',
            title: 'Write on a directory can delete anyone’s file',
            body: [
              'Ravi does not own **`draft.txt`**. He can still delete it. Write permission on a directory is permission to create, rename, or delete names, including a name someone else owns.',
              'The **sticky bit** stops that. You may delete or rename only a name you own. Root still can. **`chmod 3770`** is the sticky bit plus setgid plus **`770`**. Others have no execute on this directory, so **`ls`** shows a capital **`T`**.',
            ],
            code: {
              language: 'shell',
              code: `sudo -u ravi rm /srv/team/draft.txt

sudo chmod 3770 /srv/team
ls -ld /srv/team
# drwxrws--T root developers /srv/team
sudo -u ravi rm /srv/team/notes.txt
# Operation not permitted`,
            },
          },
        ],
        after: [
          'The leading digit is **`4`** for setuid, **`2`** for setgid, and **`1`** for the sticky bit. **`3770`** is **`2+1`**, then **`770`**. **`rws`** on a program is setuid: the program runs as the file’s owner. **`/usr/bin/sudo`** looks like this, which is why it can act as root. Setgid on a directory does a different job. It chooses the group of new files.',
        ],
        tableAfter: {
          headers: ['What ls shows', 'Meaning'],
          rows: [
            ['`s` where the group `x` was', 'setgid, and the group can enter. New files take the directory’s group'],
            ['`S`', 'setgid, and the group cannot enter'],
            ['`t` at the end', 'Sticky, and others can enter. `/tmp` is `drwxrwxrwt`'],
            ['`T` at the end', 'Sticky, and others cannot enter. `3770` is `drwxrws--T`'],
            ['`rws` on a program', 'setuid. The program runs as its owner. `sudo` is like this'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'umask chooses the letters on a new file',
          body: [
            'A new file asks for **`666`**. A new directory asks for **`777`**. **umask** turns bits off. The examples used **`umask 007`**, so others got nothing and Ravi could not read **`draft.txt`**. A login on Ubuntu more often has umask **`002`**, which leaves a file at **`664`** (`rw-rw-r--`) and a directory at **`775`**.',
            'setgid chose the group. umask chose the letters. The directory’s **`2770`** is not copied onto the file. When the mode has to be exact, as with the signing key, **`chmod`** it after it exists. A default ACL, next, replaces this umask calculation.',
          ],
        },
      },
      {
        id: 'one-extra-person',
        title: 'Leela, who is not on the team',
        body: [
          'Leela reads what the team drops in **`/srv/team`**, including a file that arrives tomorrow. She must not create or delete one, and she stays out of **developers**. Owner, group, and others have no slot for that one person. An **ACL** is the extra rule.',
          '**`setfacl -m u:leela:r-x`** lets Leela read and enter this directory. Nobody else’s access changes. **`setfacl -d -m`** stores a **default** rule that new files and new directories inherit. Set both, or tomorrow’s file is closed to her.',
          '**`ls -l`** puts a **`+`** after the letters when an ACL is present. Those nine letters have no place for Leela. **`getfacl`** prints her entry. A program creating a file asks for read and write, not execute, so her **`x`** stays on new directories and does not land on a normal new file. With a default ACL set, umask is out of that calculation.',
          '**`setfacl -x u:leela`** removes her rule on this path. **`setfacl -k`** removes the default ACL, so later files stop inheriting it. **`setfacl -b`** removes every ACL.',
        ],
        code: {
          language: 'shell',
          code: `sudo setfacl -m u:leela:r-x /srv/team
sudo setfacl -d -m u:leela:r-x /srv/team
getfacl /srv/team
# user:leela:r-x
# mask::rwx
# default:user:leela:r-x
ls -ld /srv/team
# drwxrws---+ root developers /srv/team
sudo -u asha sh -c 'echo hello > /srv/team/today.txt'
sudo -u leela cat /srv/team/today.txt
# hello
sudo -u leela touch /srv/team/nope.txt
# Permission denied`,
        },
        callout: {
          kind: 'warn',
          title: 'chmod rewrites the ACL mask',
          body: [
            '**`getfacl`** prints a **`mask`** line. Leela gets a permission only when her entry and the mask both allow it. **`chmod`** on a file that has an ACL writes the group digit into that mask. **`chmod 640`** sets the mask to **`r--`**. Her entry can still say **`rw-`**, and the effective right is read. **`getfacl`** marks the line **`#effective:r--`**. Run **`getfacl`** again after **`chmod`**.',
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['Who you are, with the groups this shell is using', '`id`'],
            ['Look up an account', '`getent passwd user` and `getent group group`'],
            ['Groups recorded for someone, from the files', '`id user`'],
            ['Run one command as someone else', '`sudo -u user command`'],
            ['Run one command with a group you just joined', "`sg group -c 'command'`"],
            ['Create a user with a home, bash, and an extra group', '`sudo useradd -m -s /bin/bash -G group user`'],
            ['Add a group and keep the others', '`sudo usermod -aG group user`'],
            ['Close a login and keep the home', '`sudo usermod -L -s /usr/sbin/nologin user`'],
            ['See whether the password is locked', '`passwd -S user`'],
            ['Allow one group two commands', '`%group ALL=(root) NOPASSWD: /usr/bin/systemctl restart app, /usr/bin/systemctl status app`'],
            ['Check a sudoers file', '`sudo visudo -cf /etc/sudoers.d/name`'],
            ['See the mode as a number', "`stat -c '%a' file`"],
            ['Group can read, others cannot', '`chmod 640 file`'],
            ['A private key', '`chmod 600 file`'],
            ['Set owner and group', '`sudo chown user:group file`'],
            ['Team folder, new files stay in the group', '`sudo chmod 2770 dir`'],
            ['Also stop members deleting each other’s files', '`sudo chmod 3770 dir`'],
            ['One extra person, including future files', '`setfacl -m u:name:r-x dir` and `setfacl -d -m u:name:r-x dir`'],
            ['See or clear an ACL', '`getfacl path` and `setfacl -b path`'],
          ],
        },
      },
    ],
    takeaways: [
      'Grant access to a group. **`adm`** reads logs. The **`sudo`** group is every command as root, so a team that may restart one service gets a sudoers file instead.',
      '**`usermod -aG`** adds a group. **`-G`** alone drops the groups you left off the command. **`-L`** and a **`nologin`** shell close a login and leave the home in place.',
      'Linux applies one trio: owner, else the file’s group, else others. Root owns the config and the program. The service account owns the secret, the key, and the logs. **`600`** keeps the key to its owner.',
      '**`2770`** puts a new file in the team group. **`3770`** also stops a teammate deleting someone else’s file. A default ACL lets one outsider read files that are not there yet.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-07-onboard-the-payments-team', label: 'Onboard the Payments Team' },
      { challengeId: 'linux-08-lock-down-payment-secrets', label: 'Lock Down Payment Secrets' },
      { challengeId: 'linux-09-shared-drop-folder-for-notifications', label: 'Shared Drop Folder for Notifications' },
    ],
  },
  {
    id: 'processes-and-signals',
    slug: 'processes-and-signals',
    trackId: 'B5',
    eyebrow: '',
    title: 'Processes and Signals: ps, top, kill, nice',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-10-hunt-the-runaway-process',
    lede:
      'Checkout on the **order box** is crawling. The CPU graph is stuck at 100%. Something is burning the machine. This post is how you **find** that process, **stop** it without taking down the wrong worker, and make a heavy report **share** the CPU.',
    sections: [
      {
        id: 'what-is-a-process',
        title: 'A program that is running',
        body: [
          'A **program** is a file on disk, for example **`/opt/order-processor/bin/order-reindex`**. A **process** is one running copy of it, with its own memory, its own owner, and its own number, the **PID**. Start the same program twice and you get two processes with two PIDs.',
          'Every process was started by another process, its **parent**. The parent’s PID is the **PPID**. Follow the parents far enough and you reach PID **1** — **systemd** on most servers — which the kernel starts at boot.',
        ],
        subsections: [
          {
            id: 'pid-ppid',
            title: 'Your shell’s PID, and a background PID',
            body: [
              'In the shell, a word that starts with **`$`** is replaced before the command runs. **`$$`** is this shell’s PID. Put **`&`** at the end of a command and the shell starts it in the **background**: it prints the new PID and gives you the prompt back. **`$!`** is that last background PID. Background jobs that must survive logout are the next post.',
            ],
            code: {
              language: 'shell',
              code: `echo $$
# 1901
sleep 300 &
# [1] 1950
echo $!
# 1950`,
            },
          },
        ],
        callout: {
          kind: 'idea',
          title: 'Three jobs on the order box',
          body: [
            'Tonight three programs are running as the **`orders`** account. **`order-reindex`** is rebuilding a search index and will not stop. **`report-builder`** is the nightly report: it may keep running, but it must stay out of the way. **`notification-retry`** must not be touched. The CPU graph is pinned. One of those three is the reason.',
          ],
        },
      },
      {
        id: 'find-the-hog',
        title: 'Find what is burning the CPU',
        body: [
          'You do not guess. You ask the machine which process is using the CPU, who owns it, and what command started it.',
        ],
        subsections: [
          {
            id: 'ps',
            title: 'ps: a snapshot right now',
            body: [
              '**`ps`** prints the processes running at this moment and exits. On its own it only shows processes from your current terminal. That is rarely enough.',
              '**`ps aux`** is the common form: **`a`** is every user, **`u`** adds owner and CPU columns, **`x`** includes processes with no terminal, such as services. There is no dash on **`aux`**. **`ps -ef`** is an older style that shows every process with its parent PID.',
              '**`--sort=-%cpu`** (or **`--sort=-pcpu`**) puts the heaviest process first. The leading **`-`** means descending. **`head`** keeps the top lines.',
            ],
            code: {
              language: 'shell',
              code: `ps aux --sort=-%cpu | head -5
ps -eo pid,user,ni,pcpu,cmd --sort=-pcpu | head -5
# PID USER  NI %CPU CMD
# 1842 orders 0 99.7 /opt/order-processor/bin/order-reindex
# 1901 orders 0  0.1 /opt/order-processor/bin/report-builder
# 1910 orders 0  0.0 /opt/notification-service/bin/notification-retry`,
            },
          },
          {
            id: 'read-ps',
            title: 'What those columns mean',
            body: [
              'Four columns do most of the work. **PID** is the number you act on. **%CPU** (or **pcpu**) is the share of one core. **USER** is who owns it. **CMD** (or **COMMAND**) is how it was started. **NI** is niceness, which comes later.',
              '**STAT** is the state. A process is not always busy. Most of the time it is sleeping and uses no CPU. **`order-reindex`** is **R** (running). A waiting shell is **S**.',
            ],
          },
        ],
        table: {
          headers: ['STAT', 'Meaning'],
          rows: [
            ['`R`', 'Running, or ready to run on a CPU'],
            ['`S`', 'Sleeping: waiting for input, a timer, or the network'],
            ['`D`', 'Waiting on disk; cannot be interrupted until the disk answers'],
            ['`T`', 'Stopped (paused), for example after Ctrl-Z'],
            ['`Z`', 'Zombie: finished, but its parent has not collected the exit status'],
          ],
        },
        after: [
          '**`top`** shows the same facts and refreshes every few seconds, sorted by CPU, so a hog floats up on its own. Press **P** to sort by CPU, **M** by memory, **k** to kill by PID, and **q** to quit. **`htop`** is a friendlier version if it is installed.',
        ],
        code: {
          language: 'shell',
          code: `top
# P sort by CPU, M by memory, k kill, q quit
top -u orders
htop`,
        },
        tableAfter: {
          headers: ['Tool', 'Shows', 'Use it when'],
          rows: [
            ['`ps aux` / `ps -eo …`', 'A snapshot of every process', 'You want a list right now, or to pipe into `head`'],
            ['`top` / `htop`', 'A live view, sorted by CPU', 'Something is slow and you want to watch it'],
            ['`pgrep -af name`', 'PIDs matching a name or path', 'You know the name and need the PID'],
            ['`/proc/PID/`', 'Kernel details for one process', 'You need the exact command, folder, or memory'],
          ],
        },
      },
      {
        id: 'pgrep-proc',
        title: 'Get the PID without scanning by eye',
        body: [
          'Scanning **`ps aux`** by eye is slow when many lines look similar. **`pgrep`** prints the PIDs whose name matches. **`-a`** shows the full command line. **`-f`** matches against the whole command line, not only the short name — that is how you pick **`order-reindex`** out of a path under **`/opt`**. **`-u`** limits the search to one user.',
          'Write the PID down when you will use it more than once. A file under **`~/answers/`** is enough for a lab. **`pidof`** does the same job for an exact program name.',
        ],
        code: {
          language: 'shell',
          code: `pgrep -af order-reindex
# 1842 /opt/order-processor/bin/order-reindex
mkdir -p ~/answers
pgrep -f order-reindex > ~/answers/runaway-pid
cat ~/answers/runaway-pid
# 1842
pgrep -u orders -af report-builder
pidof sshd`,
        },
        after: [
          'The kernel also publishes one process as files under **`/proc/PID/`**. Nothing there is on disk. **`status`** has the name, state, owner, and memory. **`cmdline`** has the exact command, with words separated by null characters instead of spaces — feed it to **`tr`** so it reads normally. **`cwd`** points at the folder it is running in.',
        ],
        codes: [
          {
            language: 'shell',
            code: `cat /proc/1842/status | head
tr '\\0' ' ' < /proc/1842/cmdline
ls -l /proc/1842/cwd`,
          },
        ],
        callout: {
          kind: 'warn',
          title: 'Match the path, not a short name',
          body: [
            '**`pgrep reindex`** can match more than you meant. **`pgrep -f order-reindex`** matches the command line. Run **`pgrep -af`** first and read the lines before you act.',
          ],
        },
      },
      {
        id: 'stop-it',
        title: 'Stop the runaway',
        body: [
          'You do not stop a process directly. You send it a **signal** — a small numbered message the kernel delivers. Most signals can be **caught**, which lets the program clean up first. A couple cannot be caught at all.',
          'Despite the name, **`kill`** only sends a signal. With no options it sends **SIGTERM** (15): please exit. **`kill -9`** and **`kill -KILL`** are the same: **SIGKILL**, which the kernel enforces and the program cannot ignore. You can signal your own processes. Signalling another user’s process needs **`sudo`**.',
        ],
        subsections: [
          {
            id: 'term-then-kill',
            title: 'Ask first, force second',
            body: [
              'Always try **SIGTERM** first. A well-behaved program catches it, finishes or saves what it is doing, and exits. Give it a few seconds, then check whether it is still there.',
              '**`order-reindex`** ignores SIGTERM on purpose in this story. **`ps -p`** still prints a line after **`kill`**. Then use **SIGKILL**. The kernel removes the process on the spot. It gets no chance to clean up, so half-written files and leftover locks are common side effects. Use **`-9`** only when SIGTERM was ignored.',
            ],
            code: {
              language: 'shell',
              code: `PID=$(cat ~/answers/runaway-pid)
sudo kill "$PID"
ps -p "$PID"
# still there: it ignored SIGTERM
sudo kill -9 "$PID"
ps -p "$PID"
# gone`,
            },
          },
          {
            id: 'common-signals',
            title: 'The signals you will actually use',
            body: [
              'There are dozens of signals. Six cover almost everything. You already send some from the keyboard: **Ctrl-C** sends **SIGINT** to the program in front of you, and **Ctrl-Z** pauses it.',
            ],
          },
        ],
        table: {
          headers: ['Number', 'Name', 'Sent by', 'Meaning'],
          rows: [
            ['`2`', '`SIGINT`', 'Ctrl-C', 'Interrupt: stop what you are doing'],
            ['`15`', '`SIGTERM`', '`kill` (default)', 'Please exit: clean up and quit'],
            ['`9`', '`SIGKILL`', '`kill -9`', 'Die now: cannot be caught or ignored'],
            ['`1`', '`SIGHUP`', 'Terminal closed', 'Hang up; many services reload config on it'],
            ['`19`', '`SIGSTOP`', '`kill -STOP`', 'Pause (Ctrl-Z sends the similar SIGTSTP)'],
            ['`18`', '`SIGCONT`', '`kill -CONT`, `fg`, `bg`', 'Resume a paused process'],
          ],
        },
        after: [
          '**`pkill`** sends a signal to every process whose name matches — **`pgrep`** and **`kill`** in one step. **`killall`** does the same for an exact program name. They hit every match, so run **`pgrep -af`** first.',
          'Sometimes you only want to pause a job. **SIGSTOP** freezes it (state **T**). **SIGCONT** lets it continue where it left off.',
        ],
        codes: [
          {
            language: 'shell',
            code: `pgrep -af order-reindex
sudo pkill -f order-reindex
# or, only if it ignored SIGTERM:
sudo pkill -9 -f order-reindex

kill -STOP 1901
ps -o pid,stat,cmd -p 1901
kill -CONT 1901`,
          },
        ],
        callout: {
          kind: 'warn',
          title: 'Leave the workers that must stay',
          body: [
            'On this box **`notification-retry`** must keep running, and **`report-builder`** must stay up too. Kill the PID you recorded for the hog. Do not **`pkill -f order`** and hope — that pattern can match more than one program.',
          ],
        },
      },
      {
        id: 'nice',
        title: 'Make the report share the CPU',
        body: [
          'When several processes want the CPU, the kernel shares it. A process’s **niceness** tells the kernel how much to favour it. The range is **-20** (greedy) to **19** (nicest, gets what is left). Everything starts at **0**.',
          '**`report-builder`** is allowed to keep running. It must stay out of the way of checkout. Raise its niceness to **15** without restarting it. Any user can make their own processes nicer. Only root can make a process **less** nice (a lower number), and only root can change another user’s process.',
        ],
        subsections: [
          {
            id: 'renice',
            title: 'renice: change a running process',
            body: [
              '**`renice -n N -p PID`** sets niceness **N** on a process that is already running. **`-u`** changes every process owned by that user.',
            ],
            code: {
              language: 'shell',
              code: `pgrep -af report-builder
sudo renice -n 15 -p "$(pgrep -f report-builder)"
ps -o pid,ni,cmd -p "$(pgrep -f report-builder)"
# PID  NI CMD
# 1901 15 /opt/order-processor/bin/report-builder`,
            },
          },
          {
            id: 'nice-start',
            title: 'nice: start with a priority',
            body: [
              '**`nice -n N command`** starts a new command at niceness **N**. Without **`-n`** it uses **10**, a sensible default for background work. Use this when you know the job will be heavy before you start it.',
            ],
            code: {
              language: 'shell',
              code: `nice -n 15 /opt/order-processor/bin/report-builder &
nice ./report.sh
sudo nice -n -5 ./urgent.sh`,
            },
          },
        ],
        after: [
          'The **NI** column in **`ps`** and **`top`** is niceness. Next to it in **`top`**, **PR** is the kernel’s own priority number, which moves with NI.',
        ],
        code: {
          language: 'shell',
          code: `ps -o pid,ni,cmd -p 1901
ps -eo pid,ni,comm --sort=-ni | head`,
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['This shell’s PID / last background PID', '`echo $$`, `echo $!`'],
            ['Heaviest by CPU', '`ps aux --sort=-%cpu | head`, `ps -eo pid,user,ni,pcpu,cmd --sort=-pcpu | head`'],
            ['Live view', '`top` (P, M, k, q), `htop`'],
            ['Find a PID by name or path', '`pgrep -af name`'],
            ['Details for one process', '`cat /proc/PID/status`, `tr \'\\0\' \' \' < /proc/PID/cmdline`'],
            ['Ask to exit', '`sudo kill PID` (SIGTERM)'],
            ['Force stop', '`sudo kill -9 PID` (SIGKILL)'],
            ['Stop by name, after checking', '`pgrep -af name`, then `sudo pkill -f name`'],
            ['Pause / resume', '`kill -STOP PID`, `kill -CONT PID`'],
            ['Start with low priority', '`nice -n 15 command`'],
            ['Change a running process’s priority', '`sudo renice -n 15 -p PID`'],
          ],
        },
      },
    ],
    takeaways: [
      'A **process** is a running program with a **PID**. Find the hog with **`ps`** sorted by CPU, or with **`top`**, before you act.',
      '**`pgrep -af`** matches the full command line. Record the PID. Leave the workers that must stay running alone.',
      '**`kill`** sends **SIGTERM** first. Use **`-9`** only when that was ignored. Another user’s process needs **`sudo`**.',
      '**`renice`** changes a running job’s priority. Higher niceness means lower priority. **`nice`** starts a new job that way.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-10-hunt-the-runaway-process', label: 'Hunt the Runaway Process' },
    ],
  },
  {
    id: 'background-jobs-and-nohup',
    slug: 'background-jobs-and-nohup',
    trackId: 'B6',
    eyebrow: '',
    title: 'Background Jobs: &, jobs, nohup, tmux',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-11-keep-the-batch-running-after-logout',
    lede:
      'Every night someone runs **`batch-export`** on the **order box** to push the day’s orders to the warehouse. It takes about an hour. Twice this week the export died halfway when a laptop slept and the terminal closed. This post is how you run that job in the **background**, keep using the shell, and keep the export alive after you **log out**.',
    sections: [
      {
        id: 'foreground-background',
        title: 'Foreground holds the prompt',
        body: [
          'When you type a command, the shell normally **waits** for it to finish before showing the prompt again. That command is in the **foreground**: it owns the terminal, and you cannot type anything else until it is done. For **`ls`** that is fine. For an hour-long export, it is not.',
          'The program on this box is **`/opt/order-processor/bin/batch-export`**. It prints a line for every batch it sends. Any long command works the same way. **`sleep 600`** is a harmless stand-in while you practise.',
        ],
        subsections: [
          {
            id: 'ampersand',
            title: '&: start in the background',
            body: [
              'Put **`&`** at the end of a line and the shell starts the command in the **background**. It prints a **job number** in brackets and the process **PID**, then gives you the prompt back. The command keeps running while you do other work.',
              'One catch: a background command still prints to your terminal, mixed into whatever you are typing. Send the output to a file instead.',
            ],
            code: {
              language: 'shell',
              code: `/opt/order-processor/bin/batch-export &
# [1] 2301
sleep 600 &
# [2] 2302`,
            },
          },
          {
            id: 'redirect',
            title: 'Send stdout and stderr to a log',
            body: [
              'Programs have two output streams: **stdout** for normal lines and **stderr** for errors. **`> file`** sends stdout into a file. **`2>&1`** means “send stderr (stream **2**) to the same place as stdout (stream **1**)”. Put **`2>&1`** **after** **`> file`**. The order matters.',
              '**`>>`** appends instead of replacing the file. Watch progress with **`tail -f`**. **Ctrl-C** stops **`tail`**, not the batch.',
            ],
            code: {
              language: 'shell',
              code: `/opt/order-processor/bin/batch-export > ~/batch-export.log 2>&1 &
tail -f ~/batch-export.log
# Ctrl-C stops watching. The export keeps running.`,
            },
          },
        ],
        callout: {
          kind: 'idea',
          title: 'Background is not enough',
          body: [
            'A job started with **`&`** still belongs to this shell. Close the terminal, or drop the SSH session, and that job dies. The next sections fix that.',
          ],
        },
      },
      {
        id: 'job-control',
        title: 'Job control: practise on the export',
        body: [
          'Every command you start from a shell is a **job** of that shell, numbered **1**, **2**, **3**…. Refer to a job as **`%1`**, **`%2`**, and so on — that is not a PID. Before you rely on **`nohup`**, practise moving **`batch-export`** between foreground and background.',
        ],
        subsections: [
          {
            id: 'ctrl-z-jobs-bg-fg',
            title: 'Ctrl-Z, jobs, bg, fg, Ctrl-C',
            body: [
              'Start the export in the foreground. Press **Ctrl-Z** to pause it. The shell prints **Stopped** and gives you the prompt. **`jobs`** lists the jobs of **this** shell. The **`+`** marks the current job — the one **`fg`** and **`bg`** act on if you omit a number. **`jobs -l`** also shows PIDs.',
              '**`bg`** resumes the paused job in the background. **`fg`** brings it back to the foreground so it owns the terminal again. In the foreground, **Ctrl-C** sends **SIGINT** and stops it.',
            ],
            code: {
              language: 'shell',
              code: `/opt/order-processor/bin/batch-export
# Ctrl-Z
# [1]+  Stopped                 /opt/order-processor/bin/batch-export
jobs
# [1]+  Stopped                 /opt/order-processor/bin/batch-export
bg
# [1]+ /opt/order-processor/bin/batch-export &
jobs -l
fg
# Ctrl-C stops it`,
            },
          },
        ],
        table: {
          headers: ['Action', 'How'],
          rows: [
            ['Start in the background', '`command &`'],
            ['List jobs', '`jobs`, `jobs -l`'],
            ['Pause the foreground job', '**Ctrl-Z**'],
            ['Resume in the background', '`bg` or `bg %N`'],
            ['Bring to the foreground', '`fg` or `fg %N`'],
            ['Stop a foreground job', '**Ctrl-C**'],
            ['Signal a job by number', '`kill %N`'],
          ],
        },
        callout: {
          kind: 'warn',
          title: 'jobs only knows this shell',
          body: [
            '**`jobs`** is empty in a new login. After you log out and back in, find the export with **`pgrep -af batch-export`**, the same way you find any other process.',
          ],
        },
      },
      {
        id: 'hangup',
        title: 'Why the export died halfway',
        body: [
          'Background jobs still belong to the shell that started them. When that terminal goes away — you close the window, the laptop sleeps, or an SSH link drops — the system sends **SIGHUP** (“hang up”). The shell passes it on. The default reaction is to **exit**, so the warehouse gets half the orders.',
          'You reach a remote server with **SSH**. Close the laptop and that session ends the same way a local terminal does. SSH gets its own post later. For tonight, the export has to ignore SIGHUP.',
        ],
        code: {
          language: 'shell',
          code: `# What closing the terminal does to an unprotected job:
/opt/order-processor/bin/batch-export > ~/batch-export.log 2>&1 &
PID=$!
kill -HUP "$PID"
pgrep -af batch-export
# empty: the export exited on SIGHUP`,
        },
      },
      {
        id: 'nohup-disown',
        title: 'Survive logout: nohup and disown',
        body: [
          'Make the job ignore SIGHUP. Use **`nohup`** when you are **starting** the command. Use **`disown`** when it is **already running** without **`nohup`**.',
        ],
        subsections: [
          {
            id: 'nohup',
            title: 'nohup: the recipe for tonight',
            body: [
              '**`nohup command`** starts the command with SIGHUP ignored. Add **`&`** or it still holds the prompt in the foreground.',
              'Without a redirection, **`nohup`** writes to **`nohup.out`** in the current folder. Name your own log. The line the lab expects is one piece at a time: **`nohup`** ignores hang-ups, **`> ~/batch-export.log 2>&1`** catches both streams, **`&`** returns the prompt.',
            ],
            code: {
              language: 'shell',
              code: `cd ~
nohup /opt/order-processor/bin/batch-export > ~/batch-export.log 2>&1 &
jobs -l
# [1]+ 2301 Running  nohup /opt/order-processor/bin/batch-export > ... &
tail -f ~/batch-export.log
# batch-export: exported batch 12/1800
# Ctrl-C stops tail only`,
            },
          },
          {
            id: 'prove-it',
            title: 'Prove it survives hang-up',
            body: [
              'You do not have to log out to check. **`kill -HUP`** is what a closing terminal sends. After **`nohup`**, the process should still be there. Run it as **`learner`**, not as root: the export is your job for the night.',
            ],
            code: {
              language: 'shell',
              code: `pgrep -af batch-export
# 2301 /opt/order-processor/bin/batch-export
kill -HUP "$(pgrep -f batch-export)"
pgrep -af batch-export
# 2301 ... still running`,
            },
          },
          {
            id: 'disown',
            title: 'disown: already started without nohup',
            body: [
              'Started the export with only **`&`**? **`disown`** removes it from the shell’s job list, so the shell will not pass SIGHUP to it when you leave. **`disown %N`** picks a job. **`disown -h`** keeps it in **`jobs`** but still protects it.',
            ],
            code: {
              language: 'shell',
              code: `/opt/order-processor/bin/batch-export > ~/batch-export.log 2>&1 &
# [1] 2301
disown %1
jobs
# empty
pgrep -af batch-export
# 2301 ... still there`,
            },
          },
        ],
        callout: {
          kind: 'tip',
          title: 'After you log back in',
          body: [
            '**`jobs`** will not list the export. Use **`pgrep -af batch-export`** and **`tail -f ~/batch-export.log`**. Stop it with **`kill`** on that PID when the warehouse has the full file.',
          ],
        },
      },
      {
        id: 'tmux',
        title: 'When you need the session back',
        body: [
          '**`nohup`** keeps one command alive. You cannot come back and type into it. **`tmux`** (and the older **`screen`**) run a **terminal session on the server** that keeps going when you disconnect. Detach, log out, log in later, and attach again. Everything inside is as you left it.',
          'Use **`tmux`** when you need an interactive shell that survives a dropped link. Use **`nohup`** when the job is one command and a log file is enough. A job that must also start again after a **reboot** belongs in a **systemd** service — that is the next post and the next lab.',
        ],
        subsections: [
          {
            id: 'tmux-basics',
            title: 'tmux: start, detach, attach',
            body: [
              '**`tmux new -s name`** starts a named session. Run commands inside it as usual — no **`&`** or **`nohup`** required for survival. Press **Ctrl-b**, release, then **d** to detach. **`tmux ls`** lists sessions. **`tmux attach -t name`** reconnects.',
            ],
            code: {
              language: 'shell',
              code: `tmux new -s export
/opt/order-processor/bin/batch-export
# Ctrl-b, then d
tmux ls
tmux attach -t export
tmux kill-session -t export`,
            },
          },
          {
            id: 'tmux-keys',
            title: 'Keys inside tmux',
            body: [
              'Every shortcut starts with the prefix **Ctrl-b**: press it, release, then the next key.',
            ],
            code: {
              language: 'text',
              code: `key (after Ctrl-b)  what it does
d                   detach: leave everything running
c                   create a new window
n / p               next / previous window
%  /  "             split side by side / top and bottom
[                   scroll mode; q to leave`,
            },
          },
          {
            id: 'screen',
            title: 'screen: the older alternative',
            body: [
              '**`screen`** works the same way and is still on many servers. Its prefix is **Ctrl-a** instead of Ctrl-b.',
            ],
            code: {
              language: 'shell',
              code: `screen -S export
# Ctrl-a, then d
screen -ls
screen -r export`,
            },
          },
        ],
        table: {
          headers: ['Tool', 'Survives logout?', 'Interact later?', 'Best for'],
          rows: [
            ['`command &`', 'No', 'Only from the same shell', 'Short work while you keep typing'],
            ['`nohup … &`', 'Yes', 'No — read its log', 'One long command, like tonight’s export'],
            ['`disown`', 'Yes', 'No — read its log', 'A job you already started without nohup'],
            ['`tmux` / `screen`', 'Yes', 'Yes — reattach', 'Long interactive work on a server'],
            ['systemd service', 'Yes, and after reboot', 'Via `systemctl` / logs', 'Something that must always be up'],
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['Run in the background with a log', '`command > log 2>&1 &`'],
            ['Watch the log', '`tail -f log` (Ctrl-C stops only tail)'],
            ['List / pause / resume / foreground', '`jobs -l`, **Ctrl-Z**, `bg`, `fg`'],
            ['Survive logout (new command)', '`nohup command > log 2>&1 &`'],
            ['Survive logout (already running)', '`disown %N`'],
            ['Prove hang-up is ignored', '`kill -HUP PID`, then `pgrep -af name`'],
            ['Find it after a new login', '`pgrep -af name`'],
            ['tmux session', '`tmux new -s name`, **Ctrl-b d**, `tmux attach -t name`'],
            ['screen session', '`screen -S name`, **Ctrl-a d**, `screen -r name`'],
          ],
        },
      },
    ],
    takeaways: [
      '**`&`** frees the prompt. Redirect with **`> log 2>&1`** and watch with **`tail -f`**. That alone does not survive logout.',
      '**Ctrl-Z**, **`jobs`**, **`bg`**, and **`fg`** move a job between foreground and background in one shell.',
      'Closing the terminal sends **SIGHUP**. **`nohup … > log 2>&1 &`** ignores it. **`disown`** rescues a job you already started. Prove it with **`kill -HUP`**.',
      '**`tmux`** keeps a whole session you can reattach to. A job that must survive a **reboot** belongs in **systemd**.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      {
        challengeId: 'linux-11-keep-the-batch-running-after-logout',
        label: 'Keep the Batch Running After Logout',
      },
    ],
  },
  {
    id: 'systemd-and-journalctl',
    slug: 'systemd-and-journalctl',
    trackId: 'B7',
    eyebrow: '',
    title: 'Services with systemd: systemctl, unit files, journalctl',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-12-run-order-processor-as-a-service',
    lede:
      '**order-processor** only ran when someone started it in a terminal. The box rebooted overnight, nobody restarted it, and orders queued for hours. **systemd** is how a Linux server keeps a program up: start it at boot, run it as the right user, and bring it back when it crashes.',
    sections: [
      {
        id: 'what-is-a-service',
        title: 'Why nohup is not enough',
        body: [
          'A **service** (a **daemon**) runs in the background with no terminal, waiting for work: web requests, payments, notifications. Nobody starts it by hand each morning.',
          '**`nohup … &`** keeps a job alive after logout. It will not start again after a **reboot**, and nobody restarts it if it **crashes**. **systemd** does both. It is the first process the kernel starts (PID **1**). It starts, stops, watches, and restarts everything else.',
          'The program on this box is **`/opt/order-processor/bin/order-processor`**. It refuses to run as root. It reads its port from **`ORDER_PROCESSOR_PORT`** in **`/etc/order-processor/order-processor.env`**. A system user **`orders`** already exists.',
        ],
        subsections: [
          {
            id: 'units',
            title: 'Units: what systemd manages',
            body: [
              'systemd calls each thing it manages a **unit**, described by a short text file. The name ends with the type: **`.service`** for a program, **`.timer`** for a schedule, **`.target`** for a stage of boot (for example **`multi-user.target`**, the normal running system).',
              'This post is about **`.service`** units. You can usually leave off **`.service`** in commands: **`order-processor`** and **`order-processor.service`** mean the same thing.',
            ],
            code: {
              language: 'shell',
              code: `systemctl list-units --type=service
systemctl list-units --type=service --state=running
systemctl list-unit-files --type=service`,
            },
          },
          {
            id: 'try-by-hand',
            title: 'Try it by hand first',
            body: [
              'Run the binary once before you write a unit. The error tells you what the unit must supply.',
            ],
            code: {
              language: 'shell',
              code: `/opt/order-processor/bin/order-processor
# ORDER_PROCESSOR_PORT is not set
sudo /opt/order-processor/bin/order-processor
# refusing to run as root
cat /etc/order-processor/order-processor.env
id orders`,
            },
          },
        ],
      },
      {
        id: 'systemctl',
        title: 'systemctl: talk to systemd',
        body: [
          '**`systemctl`** is the command. Looking at a service is allowed for everyone. Starting, stopping, or changing one needs **`sudo`**.',
        ],
        subsections: [
          {
            id: 'status',
            title: 'status: is it running?',
            body: [
              '**`systemctl status`** is always first. It shows whether the service is running, its PID, memory, and the last log lines. Press **`q`** to leave the viewer.',
            ],
            code: {
              language: 'shell',
              code: `$ systemctl status order-processor
● order-processor.service - Order Processor
     Loaded: loaded (/etc/systemd/system/order-processor.service; enabled; ...)
     Active: active (running) since Mon 2026-10-05 09:12:04 UTC; 2h ago
   Main PID: 812 (order-processor)
     Memory: 18.2M
     CGroup: /system.slice/order-processor.service
             └─812 /opt/order-processor/bin/order-processor`,
            },
          },
          {
            id: 'status-parts',
            title: 'Reading the status output',
            body: [
              'Two lines matter most. **Loaded** says whether systemd knows the unit and whether it starts at boot. **Active** says what is happening now. A service can be **enabled** but **inactive** — it will start at the next boot, but is stopped now — or the other way round.',
            ],
            code: {
              language: 'text',
              code: `●            green = running, white = stopped, red = failed
Loaded       unit file path; "enabled" = starts at boot
Active       current state, and for how long
Main PID     the PID systemd started
Memory, CPU  resources right now
CGroup       every process that belongs to this service
last lines   recent journal lines`,
            },
          },
          {
            id: 'start-stop',
            title: 'start, stop, restart, reload',
            body: [
              'These change what is happening **right now**. They do not change boot. **`restart`** stops and starts — the usual step after a config change. **`reload`** asks the program to re-read config without stopping; only some services support it.',
            ],
            code: {
              language: 'shell',
              code: `sudo systemctl start order-processor
sudo systemctl stop order-processor
sudo systemctl restart order-processor
sudo systemctl reload nginx`,
            },
          },
          {
            id: 'enable-disable',
            title: 'enable: start at boot',
            body: [
              '**`enable`** makes the service start at every boot. **`disable`** stops that. Neither starts or stops it now. Add **`--now`** to do both in one go. The common surprise: a service that works until the first reboot was started but never **enabled**.',
            ],
            code: {
              language: 'shell',
              code: `sudo systemctl enable order-processor
sudo systemctl enable --now order-processor
sudo systemctl disable --now order-processor
systemctl is-enabled order-processor
systemctl is-active order-processor`,
            },
          },
          {
            id: 'failed',
            title: 'Finding failed services',
            body: [
              'When something on a server is broken, list the units that **failed** first. After you fix the cause, **`reset-failed`** clears the red mark.',
            ],
            code: {
              language: 'shell',
              code: `systemctl --failed
systemctl is-failed order-processor
sudo systemctl reset-failed order-processor`,
            },
          },
        ],
        table: {
          headers: ['Command', 'Affects', 'What it does'],
          rows: [
            ['`status`', '—', 'State, PID, memory, recent logs'],
            ['`start` / `stop` / `restart`', 'Now', 'Run, stop, or restart'],
            ['`reload`', 'Now', 'Re-read config without stopping (if supported)'],
            ['`enable` / `disable`', 'Boot', 'Start / do not start at boot'],
            ['`enable --now`', 'Both', 'Start now and at every boot'],
            ['`--failed`', '—', 'List failed units'],
          ],
        },
      },
      {
        id: 'unit-file',
        title: 'Write a unit for order-processor',
        body: [
          'Your own units live in **`/etc/systemd/system/`**. Units from packages live in **`/lib/systemd/system/`**. Read those for examples. Do not edit them there — a package upgrade overwrites them.',
          'A unit file has three sections. **[Unit]** is what this is and when it may start. **[Service]** is how to run it. **[Install]** is where **`enable`** hooks it into boot.',
        ],
        subsections: [
          {
            id: 'the-unit-file',
            title: 'The unit file',
            body: [
              'Save this as **`/etc/systemd/system/order-processor.service`**.',
            ],
            code: {
              language: 'ini',
              filename: '/etc/systemd/system/order-processor.service',
              code: `[Unit]
Description=Order Processor
After=network.target

[Service]
User=orders
Group=orders
EnvironmentFile=/etc/order-processor/order-processor.env
ExecStart=/opt/order-processor/bin/order-processor
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target`,
            },
          },
          {
            id: 'unit-section',
            title: '[Unit]: description and order',
            body: [
              '**`Description=`** is the name in **`status`**. **`After=`** is order only: start this unit after the listed ones have started. It does not start those units by itself.',
            ],
          },
          {
            id: 'service-section',
            title: '[Service]: how to run it',
            body: [
              '**`ExecStart=`** is the command. Use a **full path**. systemd does not search your PATH, and shell tricks like **`&&`**, **`>`**, or **`~`** do not work here.',
              '**`User=`** runs the program as that account, not as root. **`EnvironmentFile=`** loads settings from a file so ops can change the port without editing the unit. **`Environment=PORT=8080`** sets one variable inline when a file is not needed.',
              '**`Restart=on-failure`** starts the program again after a crash or a non-zero exit. It does not restart after a clean **`systemctl stop`**. **`Restart=always`** restarts whenever it exits. **`RestartSec=`** waits that many seconds so a broken app does not thrash.',
            ],
          },
          {
            id: 'install-section',
            title: '[Install]: hook into boot',
            body: [
              '**`WantedBy=multi-user.target`** means start this in normal running mode — the right choice for almost every server app. **`enable`** creates a link that adds the service to that target. That is how it starts at boot.',
            ],
          },
          {
            id: 'load-and-prove',
            title: 'Load it, then prove a crash comes back',
            body: [
              'systemd reads unit files into memory. After you create or change one, run **`daemon-reload`**. Forgetting that is why an edit “does nothing.” Then **`enable --now`**, and check.',
              'The grader will kill the process. systemd must bring it back without you. Read the main PID, send **SIGKILL**, wait, and read **`status`** again.',
            ],
            code: {
              language: 'shell',
              code: `sudo nano /etc/systemd/system/order-processor.service
sudo systemctl daemon-reload
sudo systemctl enable --now order-processor
systemctl status order-processor
curl http://127.0.0.1:8080/health
# {"status":"ok",...}

sudo kill -9 "$(systemctl show -p MainPID --value order-processor)"
sleep 3
systemctl status order-processor
# active again, new PID`,
            },
          },
        ],
      },
      {
        id: 'drop-ins',
        title: 'Change a vendor unit without editing it',
        body: [
          '**payment-handler** and **order-processor** both came from a package under **`/lib/systemd/system/`**. After a reboot, order-processor came up before payment-handler, could not load its payment routes, and exited. Nothing restarted it.',
          'Edit the vendor file and the next package upgrade silently reverts your fix. Put your changes in a **drop-in** under **`/etc/systemd/system/order-processor.service.d/`**. It overrides only the keys you list.',
        ],
        subsections: [
          {
            id: 'requires-after',
            title: 'Requires and After',
            body: [
              '**`Requires=`** pulls the other unit in: starting order-processor also starts payment-handler, and stopping payment-handler stops order-processor. **`Wants=`** is softer — it still starts the other unit, but carries on if that unit fails.',
              '**`After=`** is order only. **`Requires=`** without **`After=`** starts both at the same time. You usually want both lines.',
            ],
          },
          {
            id: 'systemctl-edit',
            title: 'systemctl edit writes the drop-in',
            body: [
              '**`systemctl edit order-processor`** opens an editor, saves to **`…/order-processor.service.d/override.conf`**, and reloads systemd for you. **`systemctl cat`** prints the vendor unit plus every drop-in, in order.',
            ],
            code: {
              language: 'ini',
              filename: 'override.conf',
              code: `[Unit]
Requires=payment-handler.service
After=payment-handler.service

[Service]
Restart=on-failure
RestartSec=2`,
            },
          },
        ],
        codes: [
          {
            language: 'shell',
            code: `systemctl status order-processor
journalctl -u order-processor -n 20
systemctl cat order-processor

sudo systemctl edit order-processor
# paste the override, save

systemctl cat order-processor
sudo systemctl stop order-processor payment-handler
sudo systemctl start order-processor
systemctl status payment-handler order-processor
curl http://127.0.0.1:8080/health`,
          },
        ],
        after: [
          'Without **`systemctl edit`**, create the directory and file yourself, then **`daemon-reload`**.',
        ],
        code: {
          language: 'shell',
          code: `sudo mkdir -p /etc/systemd/system/order-processor.service.d
sudo nano /etc/systemd/system/order-processor.service.d/override.conf
sudo systemctl daemon-reload`,
        },
        callout: {
          kind: 'warn',
          title: 'Do not copy the whole unit into /etc',
          body: [
            'A full copy of the vendor file under **`/etc/systemd/system/`** replaces the package unit and is easy to get wrong on upgrade. A drop-in under **`.service.d/`** is the change that survives.',
          ],
        },
      },
      {
        id: 'journalctl',
        title: 'journalctl: read the story',
        body: [
          'Anything a service prints — normal lines and errors — lands in the **journal**, together with systemd’s own start and stop messages. **`journalctl`** reads it. You may need **`sudo`**, or membership in **`adm`** / **`systemd-journal`**, to see other services’ logs.',
        ],
        subsections: [
          {
            id: 'journal-unit',
            title: 'Logs for one service',
            body: [
              '**`-u`** limits the output to one unit. **`-n`** keeps the last N lines. **`--no-pager`** prints straight to the terminal instead of opening a viewer.',
            ],
            code: {
              language: 'shell',
              code: `journalctl -u order-processor -n 20 --no-pager
journalctl -u notification-service -n 30 --no-pager`,
            },
          },
          {
            id: 'journal-options',
            title: 'Useful options',
            body: [
              '**`-f`** follows new lines live, like **`tail -f`**. **`-e`** jumps to the end. **`--since`** and **`--until`** limit the time range and understand words like **`"1 hour ago"`** or **`today`**. **`-b`** is this boot (**`-b -1`** the one before). **`-p err`** is errors and worse.',
            ],
            code: {
              language: 'shell',
              code: `journalctl -u order-processor -f
journalctl -u order-processor --since "1 hour ago"
journalctl -u order-processor --since today -p err
journalctl -b -p err`,
            },
          },
        ],
      },
      {
        id: 'debugging',
        title: 'When a service will not stay up',
        body: [
          '**notification-service** is in a restart loop. The person who set it up is away. Work the same loop every time: **`status`** → **`journalctl -u`** → fix one cause → **`daemon-reload`** if you edited the unit → **`restart`** → read the journal again. Each fix reveals the next error. Do not “fix” it by running as root or deleting the unit.',
        ],
        bullets: [
          '**Wrong path in `ExecStart=`** — status **`203/EXEC`**, journal says “Failed to locate executable.” Point at the real binary.',
          '**Binary not executable** — same **`203/EXEC`**, or “Permission denied.” **`chmod 755`** on the program.',
          '**Typo in an environment file** — the program starts, then exits: “SMTP_HOST is not set.” Fix the file. Env changes need a **restart**, not **`daemon-reload`**.',
          '**Port already in use** — journal says “address in use.” **`sudo ss -tlnp`** shows who holds the port; stop that process.',
          '**Edited the unit but nothing changed** — you forgot **`daemon-reload`**.',
          '**Works until reboot** — started but never **enabled**.',
          '**Keeps restarting** — **`Restart=`** is bringing back a program that crashes immediately. The real error is earlier in the journal.',
        ],
        codes: [
          {
            language: 'shell',
            code: `systemctl status notification-service
journalctl -u notification-service -n 30 --no-pager

# After fixing the unit file:
sudo systemctl daemon-reload
sudo systemctl restart notification-service

# After fixing only an env file:
sudo systemctl restart notification-service

# Port conflict:
sudo ss -tlnp | grep 8085
sudo pkill -f /usr/local/bin/debug-listener
sudo systemctl restart notification-service
curl http://127.0.0.1:8085/health`,
          },
        ],
        callout: {
          kind: 'tip',
          title: 'daemon-reload vs restart',
          body: [
            'Changed a **unit file** or a **drop-in**? **`daemon-reload`**, then **`restart`**. Changed only an **EnvironmentFile** or the app’s own config? **`restart`** is enough.',
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['Is it running?', '`systemctl status name`'],
            ['Start / stop / restart', '`sudo systemctl start|stop|restart name`'],
            ['Start at boot (and now)', '`sudo systemctl enable --now name`'],
            ['Do not start at boot', '`sudo systemctl disable name`'],
            ['List failed units', '`systemctl --failed`'],
            ['After editing a unit or drop-in', '`sudo systemctl daemon-reload`'],
            ['Show vendor unit + drop-ins', '`systemctl cat name`'],
            ['Add a drop-in', '`sudo systemctl edit name`'],
            ['Main PID', '`systemctl show -p MainPID --value name`'],
            ['Service logs', '`journalctl -u name -n 50 --no-pager`'],
            ['Follow logs live', '`journalctl -u name -f`'],
            ['Who holds a port', '`sudo ss -tlnp`'],
          ],
        },
      },
    ],
    takeaways: [
      '**systemd** owns long-running programs: start at boot, run as a dedicated user, restart on crash. **`nohup`** is not that.',
      '**`systemctl status`** first. **`start` / `stop` / `restart`** change now. **`enable` / `disable`** change boot. **`enable --now`** does both.',
      'Put your units in **`/etc/systemd/system/`**. Change a package unit with a **drop-in** (**`systemctl edit`**), not by editing **`/lib`**. Use **`Requires=`** and **`After=`** together when one service needs another first.',
      'Debug with **`status`** and **`journalctl -u`**. Fix one cause at a time. **`daemon-reload`** after unit edits; **`restart`** alone after env-file edits.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-12-run-order-processor-as-a-service', label: 'Run Order Processor as a Service' },
      { challengeId: 'linux-13-restart-on-crash-start-in-order', label: 'Restart on Crash, Start in Order' },
      { challengeId: 'linux-14-debug-a-failing-unit', label: 'Debug a Failing Unit' },
    ],
  },
  {
    id: 'cron-and-log-rotation',
    slug: 'cron-and-log-rotation',
    trackId: 'B8',
    eyebrow: '',
    title: 'Cron and Log Rotation',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-15-nightly-reconciliation',
    lede:
      'Three jobs on the **order box** only run when someone remembers them. **`notification.log`** on the notification box has never been rotated and is eating the disk. This post is how you **schedule** work with cron and systemd timers, and how **logrotate** keeps a growing log from filling the machine.',
    sections: [
      {
        id: 'two-schedulers',
        title: 'Two ways to run something on a schedule',
        body: [
          'Tonight the team needs three repeating jobs:',
        ],
        bullets: [
          '**Order reconciliation** at **02:30** as **`recon`**. If the box was down at 02:30, it must catch up when the box comes back.',
          '**Notification digest** every **15 minutes** as **`notify`**.',
          'Your **disk report** every morning at **07:00** as you.',
        ],
        after: [
          'Linux gives you two schedulers. **cron** is one line per job, simple and everywhere. A **systemd timer** is more verbose, but you get journal logs, **`Persistent=`** catch-up after downtime, and **`systemctl list-timers`**. Reconciliation belongs on a timer. The digest and the disk report belong on cron.',
        ],
        tableAfter: {
          headers: ['Tool', 'Best for', 'Where the schedule lives'],
          rows: [
            ['User crontab', 'Jobs for your own login', '`crontab -e`'],
            ['`/etc/cron.d/`', 'System jobs that name a user', 'One file per job, owned by root'],
            ['systemd timer', 'Catch-up after downtime, journal logs', '`.timer` + oneshot `.service`'],
          ],
        },
      },
      {
        id: 'cron',
        title: 'cron: five fields, then the command',
        body: [
          'A crontab line is five time fields, then the command. The fields are **minute**, **hour**, **day of month**, **month**, **day of week**. **`*`** means every value. **`*/15`** means every 15 units.',
        ],
        subsections: [
          {
            id: 'user-crontab',
            title: 'Your own crontab',
            body: [
              '**`crontab -e`** edits the schedule for your login. There is **no user column** — the command already runs as you. **`crontab -l`** prints the file. Redirect output, or cron mails it to you (and many servers have no mail).',
            ],
            code: {
              language: 'shell',
              code: `crontab -e
# minute hour dom mon dow  command
0 7 * * * /opt/order-processor/bin/disk-report
crontab -l`,
            },
          },
          {
            id: 'cron-d',
            title: '/etc/cron.d: system jobs with a user',
            body: [
              'Files under **`/etc/cron.d/`** are for the whole machine. They have an extra **user** column between the schedule and the command. Own them as **root**, mode **`644`** — group or world writable files are ignored.',
            ],
            code: {
              language: 'shell',
              code: `echo '*/15 * * * * notify /opt/notification-service/bin/digest' | sudo tee /etc/cron.d/notification-digest
sudo chmod 644 /etc/cron.d/notification-digest
# m h dom mon dow  user    command`,
            },
          },
        ],
        table: {
          headers: ['Field', 'Range', 'Examples'],
          rows: [
            ['minute', '0–59', '`0`, `*/15`'],
            ['hour', '0–23', '`2`, `7`'],
            ['day of month', '1–31', '`*` = every day'],
            ['month', '1–12', '`*` = every month'],
            ['day of week', '0–7 (0 and 7 = Sunday)', '`*` = every day'],
          ],
        },
        callout: {
          kind: 'warn',
          title: 'cron.d is not crontab -e',
          body: [
            'A personal crontab has five time fields. A file in **`/etc/cron.d/`** has six fields before the command: the sixth is the **user**. Leave that column out and the line is wrong.',
          ],
        },
      },
      {
        id: 'systemd-timers',
        title: 'systemd timer: catch up after downtime',
        body: [
          'Reconciliation must run at **02:30**, and if the box was off at that minute, it must run when the box comes back. That is **`Persistent=true`** on a timer. Pair a **oneshot** service (run once and exit) with a timer that starts it.',
        ],
        subsections: [
          {
            id: 'oneshot-service',
            title: 'The oneshot service',
            body: [
              '**`Type=oneshot`** means systemd treats the job as finished when **`ExecStart=`** exits. There is usually no **`[Install]`** on this service — you enable the **timer**, not the service.',
            ],
            code: {
              language: 'ini',
              filename: '/etc/systemd/system/order-reconcile.service',
              code: `[Unit]
Description=Reconcile yesterday's orders

[Service]
Type=oneshot
User=recon
ExecStart=/opt/order-reconciliation/bin/reconcile`,
            },
          },
          {
            id: 'timer-unit',
            title: 'The timer',
            body: [
              '**`OnCalendar=`** is the schedule. **`*-*-* 02:30:00`** means every day at 02:30. **`Persistent=true`** runs a missed start after the machine was down. **`WantedBy=timers.target`** is what **`enable`** hooks into.',
            ],
            code: {
              language: 'ini',
              filename: '/etc/systemd/system/order-reconcile.timer',
              code: `[Unit]
Description=Nightly order reconciliation

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target`,
            },
          },
          {
            id: 'enable-timer',
            title: 'Enable the timer, test the service',
            body: [
              '**`daemon-reload`**, then **`enable --now`** on the **timer**. Check the next run with **`list-timers`**. Check the calendar string with **`systemd-analyze calendar`**. Start the **service** once by hand to prove the command works; its logs are in the journal.',
            ],
            code: {
              language: 'shell',
              code: `sudo systemctl daemon-reload
sudo systemctl enable --now order-reconcile.timer
systemctl list-timers order-reconcile.timer
systemd-analyze calendar '*-*-* 02:30:00'
sudo systemctl start order-reconcile.service
journalctl -u order-reconcile.service -n 5`,
            },
          },
        ],
        callout: {
          kind: 'tip',
          title: 'Enable the timer, not the service',
          body: [
            '**`systemctl enable order-reconcile.service`** does nothing useful here — the service has no **`[Install]`**. Enable **`order-reconcile.timer`**.',
          ],
        },
      },
      {
        id: 'logrotate',
        title: 'logrotate: stop the log from eating the disk',
        body: [
          '**`/var/log/notification-service/notification.log`** grows every few seconds and has never been rotated. On the last box, the disk filled and order confirmations stopped.',
          '**logrotate** runs daily (from a timer or cron). It renames or copies the active log, compresses old copies, and deletes the oldest. Rules live in **`/etc/logrotate.d/`**. Read the files already there before you write your own.',
        ],
        subsections: [
          {
            id: 'open-log',
            title: 'Does the service reopen its log?',
            body: [
              'That question decides the rule. **notification-service** opens the log once at startup and keeps that file descriptor forever. **`lsof`** shows it. If you only rename **`notification.log`** to **`notification.log.1`**, the service keeps writing into the renamed file. New lines never hit the path you expect.',
            ],
            code: {
              language: 'shell',
              code: `ls -lh /var/log/notification-service/
sudo lsof /var/log/notification-service/notification.log
# notification-service still holds the file open
ls /etc/logrotate.d/`,
            },
          },
          {
            id: 'copytruncate',
            title: 'copytruncate when the app will not reopen',
            body: [
              '**`copytruncate`** copies the content out, then truncates the original in place. The open file descriptor still points at the same inode. The service keeps writing to **`notification.log`** without a restart.',
              'If the service could reopen on a signal, **`create`** plus a **`postrotate`** that runs **`systemctl reload …`** would be cleaner. With **`copytruncate`**, a few lines can be lost between the copy and the truncate.',
            ],
            code: {
              language: 'text',
              filename: '/etc/logrotate.d/notification-service',
              code: `/var/log/notification-service/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}`,
            },
          },
        ],
        table: {
          headers: ['Directive', 'Why'],
          rows: [
            ['`daily` / `rotate 7`', 'One file per day, keep a week'],
            ['`compress` / `delaycompress`', 'Gzip old logs; leave the newest `.1` plain for easy reading'],
            ['`missingok` / `notifempty`', 'Do not error on a missing file; skip empty ones'],
            ['`copytruncate`', 'App keeps the file open — truncate in place'],
            ['`create` + `postrotate`', 'App can reopen after a reload or signal'],
          ],
        },
        after: [
          'Dry-run first. Force a rotation only when the dry run is clean. Confirm **`notification.log.1`** (or **`.1.gz`**) exists, and that new lines still land in **`notification.log`**.',
        ],
        code: {
          language: 'shell',
          code: `sudo tee /etc/logrotate.d/notification-service >/dev/null <<'EOF'
/var/log/notification-service/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
sudo logrotate -d /etc/logrotate.d/notification-service
sudo logrotate -f /etc/logrotate.d/notification-service
ls -lh /var/log/notification-service/
tail -f /var/log/notification-service/notification.log`,
        },
        callout: {
          kind: 'warn',
          title: 'Own the rule as root',
          body: [
            'The file under **`/etc/logrotate.d/`** should be owned by **root**. A dry run with **`logrotate -d`** reports errors before you force a rotation with **`-f`**.',
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['Edit / list your crontab', '`crontab -e`, `crontab -l`'],
            ['System cron with a user', 'File in `/etc/cron.d/` (six fields: schedule, user, command), mode `644`'],
            ['Check a calendar expression', "`systemd-analyze calendar '*-*-* 02:30:00'`"],
            ['Enable a timer', '`sudo systemctl daemon-reload`, then `sudo systemctl enable --now name.timer`'],
            ['See next runs', '`systemctl list-timers`'],
            ['Run the oneshot now', '`sudo systemctl start name.service`'],
            ['Timer / service logs', '`journalctl -u name.service -n 20`'],
            ['Who holds a log open', '`sudo lsof /path/to.log`'],
            ['Dry-run / force logrotate', '`sudo logrotate -d /etc/logrotate.d/name`, `sudo logrotate -f …`'],
          ],
        },
      },
    ],
    takeaways: [
      '**cron** is one line per job. Personal crontabs have five time fields. Files in **`/etc/cron.d/`** add a **user** column and must not be group or world writable.',
      'A **systemd timer** plus a **oneshot** service gives journal logs and **`Persistent=`** catch-up. Enable the **timer**, not the service.',
      '**logrotate** rules live in **`/etc/logrotate.d/`**. If the app keeps the log open, use **`copytruncate`**. If it can reopen, prefer **`create`** and a **`postrotate`** reload.',
      'Dry-run schedules and rotation before you trust them: **`systemd-analyze calendar`**, **`logrotate -d`**, then a forced run.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-15-nightly-reconciliation', label: 'Nightly Reconciliation' },
      { challengeId: 'linux-16-rotate-notification-logs', label: 'Rotate Notification Logs' },
    ],
  },
  {
    id: 'packages-and-pinning',
    slug: 'packages-and-pinning',
    trackId: 'B9',
    eyebrow: '',
    title: 'Packages and Pinning',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-17-install-and-pin-tools',
    lede:
      'Distros install software with a **package manager** (**`apt`** on Debian/Ubuntu). **Pinning** holds a package at a version so upgrades do not break a demo. A **science museum** exhibit PC must keep a known **ffmpeg** build for a looping video wall.',
    sections: [
      {
        id: 'museum-story',
        title: 'Auto-upgrade broke the loop',
        body: [
          'Ubuntu **`unattended-upgrades`** bumped **ffmpeg**; the planetarium clip stuttered. You install a vetted version, **pin** it, and document how to upgrade deliberately.',
        ],
      },
      {
        id: 'apt-basics',
        title: 'apt commands',
        body: [],
        table: {
          headers: ['Command', 'Role'],
          rows: [
            ['`apt update`', 'Refresh package index'],
            ['`apt install pkg`', 'Install'],
            ['`apt policy pkg`', 'Show candidate + pin priority'],
            ['`apt-mark hold pkg`', 'Block upgrade (simple hold)'],
          ],
        },
      },
      {
        id: 'pinning',
        title: 'Pinning (concept)',
        body: [
          '**`/etc/apt/preferences.d/`** files set **priorities** so a version or source wins. **`apt-cache policy`** confirms what will install. Pinning is for **controlled** environments — exhibits, kiosks, legacy apps.',
        ],
      },
    ],
    takeaways: [
      '**`apt update`** then **`install`**; **`policy`** shows versions.',
      '**hold** or **preferences** prevent surprise upgrades on fixed-role machines.',
      'Treat package changes like any production change — test the exhibit loop after.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-17-install-and-pin-tools', label: 'Install and Pin Tools' },
    ],
  },
  {
    id: 'storage-df-du-and-archives',
    slug: 'storage-df-du-and-archives',
    trackId: 'B10',
    eyebrow: '',
    title: 'Storage: df, du, mounts, and tar',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-18-disk-full-on-the-order-box',
    lede:
      '**order-processor** is crash-looping on the **order box**. It cannot write its log. The separate volume at **`/var/log/order-processor`** is full, someone already deleted files, and **`du`** still shows less used space than **`df`**. This post is how you **find** what filled the disk, **free** space without losing the evidence you need, and later **archive** a bad release with **`tar`** before you roll back.',
    sections: [
      {
        id: 'what-is-full',
        title: 'Confirm which filesystem is full',
        body: [
          'Linux shows one tree starting at **`/`**, but several disks can sit under it. Each disk is a **filesystem** attached at a **mount point**. **`df`** asks a filesystem how much capacity is left. **`du`** walks files under a path and totals what it can see.',
          'Start with **`df -h`**. Read **Use%** and **Mounted on**. If only **`/var/log/order-processor`** is at 100%, cleaning **`/`** will not help. **`df -h path`** shows the filesystem that owns that path.',
        ],
        code: {
          language: 'shell',
          code: `df -h
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/nvme0n1p1   40G   12G   26G  32% /
# /dev/nvme0n1p3   64M   64M     0 100% /var/log/order-processor

df -h /var/log/order-processor
systemctl status order-processor
# crash loop: cannot write the log`,
        },
        subsections: [
          {
            id: 'bytes-or-inodes',
            title: 'Bytes or inodes',
            body: [
              'A filesystem can run out of **bytes** (a few huge files) or **inodes** (millions of tiny files). Every file and directory needs an inode. **`df -h`** can show free bytes while programs still get “No space left on device.” Check **`df -i`** too.',
            ],
            code: {
              language: 'shell',
              code: `df -i /var/log/order-processor
# IUse% near 100% means too many files, not one huge one`,
            },
          },
        ],
        callout: {
          kind: 'idea',
          title: 'Tonight on the order box',
          body: [
            'The log volume is tiny on purpose. Keep the live **`order-processor.log`** and the newest rotated copy (**`.1`**) for the timeline. Older rotations can go. The heap dump must leave this volume. Something is still holding a **deleted** file open — that is why **`df`** and **`du`** disagree.',
          ],
        },
      },
      {
        id: 'find-usage',
        title: 'Find what is using the space',
        body: [
          'Once you know the filesystem, walk it from broad to narrow with **`du`**. **`-h`** is readable units. **`-s`** is one total. **`-d1`** (or **`--max-depth=1`**) lists one level. **`-x`** stays on this filesystem so a separate **`/backup`** mount does not confuse the numbers.',
        ],
        subsections: [
          {
            id: 'du-walk',
            title: 'du from the top down',
            body: [
              'Summarize the mount, sort by size, then open the largest directory. Use **`sudo`** when permission errors would hide system files. **`ls -lhS`** sorts the current folder by size when you already know where to look.',
            ],
            code: {
              language: 'shell',
              code: `sudo du -xhd1 /var/log/order-processor 2>/dev/null | sort -h
sudo du -ah /var/log/order-processor | sort -h | tail
ls -lhS /var/log/order-processor
# order-processor-heap.hprof
# order-processor.log.5 … .1
# order-processor.log`,
            },
          },
          {
            id: 'free-obvious',
            title: 'Free the obvious space first',
            body: [
              'Delete the older rotated logs (**`.2`** through **`.5`**). Keep **`.1`** and the live log. Move the heap dump off the full volume — **`/var/tmp/`** is on a different filesystem here — so investigators still have it.',
            ],
            code: {
              language: 'shell',
              code: `sudo rm /var/log/order-processor/order-processor.log.{2,3,4,5}
sudo mv /var/log/order-processor/order-processor-heap.hprof /var/tmp/
df -h /var/log/order-processor
# better, but still higher than du says`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: 'Measure before you delete',
          body: [
            'Do not start with **`rm -rf`** because a filesystem is full. Identify the mount, identify the large path, keep the evidence you need, then remove what you can prove is safe.',
          ],
        },
      },
      {
        id: 'df-du-disagree',
        title: 'When df and du disagree',
        body: [
          '**`df`** reports what the filesystem still holds. **`du`** adds up names it can still see. Delete a file a process still has open and the name disappears from **`du`**, but the blocks stay until that process closes the handle.',
          '**`lsof +L1`** lists open files whose link count is below 1 — usually marked **`(deleted)`**. Record the process name. Restart that service so it closes the old file. Do not stop the wrong worker for good.',
        ],
        code: {
          language: 'shell',
          code: `sudo lsof +L1 /var/log/order-processor
# order-expo  1234 … /var/log/order-processor/export-spool.tmp (deleted)
mkdir -p ~/answers
echo order-exporter > ~/answers/held-by
sudo systemctl restart order-exporter
df -h /var/log/order-processor
# space comes back`,
        },
        after: [
          'Without **`lsof`**, look under **`/proc/*/fd`** for links that end in **`(deleted)`**. Then bring **order-processor** back and check health.',
        ],
        codes: [
          {
            language: 'shell',
            code: `sudo systemctl restart order-processor
systemctl status order-processor
curl http://127.0.0.1:8080/health`,
          },
        ],
      },
      {
        id: 'mounts',
        title: 'Map the mounts',
        body: [
          '**`lsblk -f`** shows devices, filesystem types, and mount points. **`findmnt`** shows what is mounted where. **`findmnt -T path`** answers which filesystem owns a path — useful when **`/var/log/order-processor`** is its own tiny volume.',
        ],
        code: {
          language: 'shell',
          code: `lsblk -f
findmnt /var/log/order-processor
findmnt -T /var/log/order-processor/order-processor.log`,
        },
        subsections: [
          {
            id: 'fstab',
            title: 'Mounts that survive reboot',
            body: [
              'A temporary **`mount`** disappears at reboot. Persistent mounts live in **`/etc/fstab`**, preferably by **UUID** from **`blkid`**. Back up **`fstab`**, edit carefully, then **`sudo mount -a`** and **`findmnt --verify`** before you reboot.',
            ],
            code: {
              language: 'shell',
              code: `sudo blkid
sudo cp /etc/fstab /etc/fstab.bak
sudoedit /etc/fstab
sudo mount -a
findmnt --verify`,
            },
          },
        ],
        callout: {
          kind: 'idea',
          title: 'Moving across mounts frees space',
          body: [
            'Moving the heap dump to **`/var/tmp/`** freed the log volume because that path is another filesystem. Moving a file inside the same mount only renames it — **`df`** does not change.',
          ],
        },
      },
      {
        id: 'tar-and-links',
        title: 'Archive a release, then roll back',
        body: [
          'A bad **order-processor** release is a different night, same toolkit. Releases live under **`/opt/order-processor/releases/`**. **`/opt/order-processor/current`** is a **symlink** to the live version. Fix the outage first: point **`current`** at the last good release. Then archive the bad folder with **`tar`**, restore an older backup if you need it, and wire config with links.',
        ],
        subsections: [
          {
            id: 'rollback-symlink',
            title: 'Roll back with a symlink',
            body: [
              '**`ln -sfn`** replaces a symlink in one step. **`-s`** makes a symlink, **`-f`** replaces, **`-n`** treats an existing symlink as a file instead of descending into the directory it points at.',
            ],
            code: {
              language: 'shell',
              code: `ls -l /opt/order-processor /opt/order-processor/releases
readlink /opt/order-processor/current
# releases/v1.2
sudo ln -sfn releases/v1.1 /opt/order-processor/current
/opt/order-processor/current/bin/order-processor
# v1.1 again`,
            },
          },
          {
            id: 'tar-archive',
            title: 'tar: create, list, extract',
            body: [
              '**`tar`** packs a directory tree into one file. Letters to remember: **`c`** create, **`t`** list, **`x`** extract, **`z`** gzip, **`f`** the archive name. **`-C dir`** changes into that directory first so paths inside the archive start at **`v1.2/`**, not a long absolute path.',
            ],
            code: {
              language: 'shell',
              code: `sudo tar -C /opt/order-processor/releases -czf /var/backups/order-processor-v1.2.tar.gz v1.2
tar -tzf /var/backups/order-processor-v1.2.tar.gz | head
# v1.2/
# v1.2/VERSION
sudo rm -rf /opt/order-processor/releases/v1.2

sudo tar -C /opt/order-processor/releases -xzf /var/backups/order-processor-v1.0.tar.gz
ls -l /opt/order-processor/releases/v1.0/bin`,
            },
          },
          {
            id: 'hard-vs-soft',
            title: 'Symlink for config, hard link for a backup',
            body: [
              'A **symlink** stores a path. Point **`/etc/order-processor/app.conf`** at **`…/current/app.conf`** so future rollbacks pick up the matching config. A **hard link** is a second name for the same inode. **`ln`** without **`-s`** makes one. **`ls -li`** shows matching inode numbers. Hard links cannot cross filesystems or point at directories.',
            ],
            code: {
              language: 'shell',
              code: `sudo ln -sfn /opt/order-processor/current/app.conf /etc/order-processor/app.conf
cat /etc/order-processor/app.conf

sudo ln /opt/order-processor/releases/v1.1/app.conf /var/backups/app.conf.v1.1
ls -li /opt/order-processor/releases/v1.1/app.conf /var/backups/app.conf.v1.1
# same inode, link count 2`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: 'List before you extract as root',
          body: [
            'Inspect an unknown archive with **`tar -tzf`** and extract into an empty temporary directory first. Archives can contain surprising paths, ownership, or overwrites.',
          ],
        },
        table: {
          headers: ['Goal', 'Command shape'],
          rows: [
            ['Create gzip archive', '`tar -C parent -czf archive.tgz dirname`'],
            ['List without extracting', '`tar -tzf archive.tgz`'],
            ['Extract into a folder', '`tar -C dest -xzf archive.tgz`'],
            ['Replace a symlink', '`ln -sfn target linkname`'],
            ['Hard-link backup', '`ln source backup-name`'],
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['Which filesystem is full?', '`df -h`, `df -h path`'],
            ['Out of inodes?', '`df -i path`'],
            ['Largest directories on one mount', '`sudo du -xhd1 path | sort -h`'],
            ['Largest files in a folder', '`du -ah path | sort -h | tail`, `ls -lhS`'],
            ['Deleted file still open?', '`sudo lsof +L1 path`'],
            ['Which device owns this path?', '`findmnt -T path`, `lsblk -f`'],
            ['Create / list / extract archive', '`tar -czf`, `tar -tzf`, `tar -xzf` (use `-C`)'],
            ['Repoint live release', '`ln -sfn releases/vX.Y /opt/.../current`'],
            ['Hard-link a file', '`ln file backup`'],
          ],
        },
      },
    ],
    takeaways: [
      '**`df`** reports a filesystem. **`du`** totals files you can still see. Start with **`df`**, then narrow with **`du -x`**.',
      'When **`df`** and **`du`** disagree, a process still holds a **deleted** file. Find it with **`lsof +L1`** and restart that process so the blocks return.',
      'Keep the evidence you need (newest log, heap dump on another mount). Delete only what you can name.',
      '**`tar -C`** builds clean archives. **`ln -sfn`** rolls a release back. A **hard link** keeps a second name for the same inode.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-18-disk-full-on-the-order-box', label: 'Disk Full on the Order Box' },
      { challengeId: 'linux-19-archive-and-roll-back-releases', label: 'Archive and Roll Back Releases' },
    ],
  },
  {
    id: 'networking-basics',
    slug: 'networking-basics',
    trackId: 'B11',
    eyebrow: '',
    title: 'Networking Basics for Operators',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-20-why-cant-order-reach-payment',
    lede:
      'Every checkout fails with *payment service unavailable*. **order-processor** calls **`http://payment.internal:9090`**. **payment-handler** was moved onto this same **order box**, and **`systemctl status`** says it is running. This post is how you debug that call from the **bottom up** — address, name, port, request — and how you open **only** the ports the network should reach.',
    sections: [
      {
        id: 'endpoint',
        title: 'Write down the exact endpoint',
        body: [
          'The failing call is **`http://payment.internal:9090/health`** (or whatever **`check-payments`** uses). It has a **protocol**, a **host name**, a **port**, and a **path**. Each part can fail on its own.',
          'Test from the machine that fails — this box — not from your laptop. A success elsewhere only proves your laptop’s DNS and path.',
        ],
        code: {
          language: 'shell',
          code: `/opt/order-processor/bin/check-payments
# payment service unavailable
cat /etc/order-processor/app.conf
# … http://payment.internal:9090 …`,
        },
        table: {
          headers: ['Part', 'Tonight', 'Question'],
          rows: [
            ['Host', '`payment.internal`', 'What IP does this name resolve to?'],
            ['Port', '`9090`', 'Is anything listening there?'],
            ['Path', '`/health`', 'Does the app answer once TCP works?'],
          ],
        },
        callout: {
          kind: 'idea',
          title: 'Bottom-up order',
          body: [
            'Who am I on the network? What does the name resolve to? Is a process listening on the right port? Does the HTTP request work? Fix the first wrong answer before you invent a new theory.',
          ],
        },
      },
      {
        id: 'who-am-i',
        title: 'Who am I on this network?',
        body: [
          '**`ip -4 addr`** shows this box’s addresses. **`ip route`** shows the default gateway. **`/etc/resolv.conf`** lists the DNS servers the system asks when a name is not in **`/etc/hosts`**.',
        ],
        code: {
          language: 'shell',
          code: `mkdir -p ~/answers
ip -4 addr show dev eth0
# inet 10.x.y.z/…
ip route
cat /etc/resolv.conf
# nameserver …

# Record without the /prefix:
ip -4 -o addr show dev eth0 | awk '{print $4}' | cut -d/ -f1 > ~/answers/box-ip
awk '/^nameserver/{print $2; exit}' /etc/resolv.conf > ~/answers/resolver`,
        },
        after: [
          '**`127.0.0.1`** means this machine. A service that only listens on loopback is fine for local curls and invisible from another host.',
        ],
      },
      {
        id: 'name-resolution',
        title: 'What does the name resolve to?',
        body: [
          '**`getent hosts`** uses the same resolver path most programs use: usually **`/etc/hosts` first**, then DNS (**`hosts: files dns`** in **`nsswitch.conf`**). That is what **order-processor** sees.',
          '**`dig`** asks DNS only and skips **`/etc/hosts`**. Empty **`dig`** plus a wrong **`getent`** answer means the lie is in **`/etc/hosts`**.',
        ],
        subsections: [
          {
            id: 'getent-vs-dig',
            title: 'getent versus dig',
            body: [
              'Record what **`payment.internal`** resolves to **before** you change it. Tonight it still points at the old box.',
            ],
            code: {
              language: 'shell',
              code: `getent hosts payment.internal
# 10.99.0.7  payment.internal
dig +short payment.internal
# (empty — DNS has no answer)
grep payment /etc/hosts
echo 10.99.0.7 > ~/answers/payment-ip-before`,
            },
          },
          {
            id: 'fix-hosts',
            title: 'Point the name at this box',
            body: [
              'Edit **`/etc/hosts`** so **`payment.internal`** is **`127.0.0.1`**. On some lab boxes **`sed -i`** fails because the file is bind-mounted — an editor that writes in place works. Confirm with **`getent`** again.',
            ],
            code: {
              language: 'shell',
              code: `sudo nano /etc/hosts
# 127.0.0.1  payment.internal
getent hosts payment.internal
# 127.0.0.1  payment.internal`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: 'A working IP can hide a DNS problem',
          body: [
            'If **`curl http://127.0.0.1:9090/health`** works but **`curl http://payment.internal:9090/health`** does not, the listener is fine. Fix the name.',
          ],
        },
      },
      {
        id: 'listeners',
        title: 'Is anything listening on that port?',
        body: [
          'A port is not a program. A process **listens** on an address and port. **`ss -tlnp`** lists TCP listeners and the owning process. Check the destination — tonight, this box.',
        ],
        subsections: [
          {
            id: 'ss',
            title: 'ss: see the real port',
            body: [
              'payment-handler may be up and still listening on the **wrong** port. Record that port, then fix the config and restart.',
            ],
            code: {
              language: 'shell',
              code: `sudo ss -tlnp
# … 127.0.0.1:9099 … users:(("payment-handler",…))
echo 9099 > ~/answers/payment-port-before

sudo sed -i 's/^PAYMENT_HANDLER_PORT=.*/PAYMENT_HANDLER_PORT=9090/' \\
  /etc/payment-handler/payment-handler.env
sudo systemctl restart payment-handler
ss -tln | grep 9090`,
            },
          },
          {
            id: 'bind-address',
            title: 'The bind address matters',
            body: [
              '**`127.0.0.1:9090`** accepts only local connections. **`0.0.0.0:9090`** accepts IPv4 on every interface. A firewall cannot make a loopback-only listener reachable from another host.',
            ],
          },
        ],
        table: {
          headers: ['ss flag', 'Meaning'],
          rows: [
            ['`-l`', 'Listening sockets'],
            ['`-t` / `-u`', 'TCP / UDP'],
            ['`-n`', 'Numeric ports (no name lookup)'],
            ['`-p`', 'Owning process (often needs sudo)'],
          ],
        },
      },
      {
        id: 'prove-request',
        title: 'Prove the request works',
        body: [
          '**`curl -v`** speaks HTTP: connect, request, response. **`nc -vz host port`** only checks that TCP accepts. Prefer the tool that matches the real client. Error text narrows the layer: **could not resolve** is DNS; **connection refused** means the host answered but nothing took that port; **timed out** usually means a drop along the path; an HTTP status proves the network path worked.',
        ],
        code: {
          language: 'shell',
          code: `curl -v --connect-timeout 5 http://payment.internal:9090/health
/opt/order-processor/bin/check-payments
# exit 0`,
        },
      },
      {
        id: 'firewall',
        title: 'Open only the right ports',
        body: [
          'A port scan of the order box lit up four listeners on every interface and **no** host firewall. **SSH (22)** and **order-processor (8080)** must stay reachable from the network. **metrics-exporter (9100)** and the **order-cache debug port (6379)** must stay up **locally** but must not answer strangers.',
          '**nftables** is the kernel firewall. The safe pattern is **default deny** on input: allow loopback, allow replies to connections this box opened, allow the ports you mean to serve — and nothing else.',
        ],
        subsections: [
          {
            id: 'see-exposure',
            title: 'See what is exposed',
            body: [
              'Confirm listeners before you write rules. An empty ruleset means everything that listens is reachable.',
            ],
            code: {
              language: 'shell',
              code: `sudo ss -tlnp
# 0.0.0.0:22, :8080, :9100, :6379
sudo nft list ruleset
# empty`,
            },
          },
          {
            id: 'nft-ruleset',
            title: 'Write, check, load, persist',
            body: [
              'Allow **SSH before** you set a drop policy on a remote box, or the next session never connects. **`nft -c -f`** checks syntax without loading. **`nftables.service`** loads **`/etc/nftables.conf`** now and at boot.',
            ],
            code: {
              language: 'ini',
              filename: '/etc/nftables.conf',
              code: `#!/usr/sbin/nft -f
flush ruleset

table inet filter {
  chain input {
    type filter hook input priority filter; policy drop;

    iif lo accept
    ct state established,related accept
    ct state invalid drop
    meta l4proto { icmp, ipv6-icmp } accept

    tcp dport { 22, 8080 } accept
  }
  chain forward {
    type filter hook forward priority filter; policy drop;
  }
  chain output {
    type filter hook output priority filter; policy accept;
  }
}`,
            },
          },
          {
            id: 'nft-apply',
            title: 'Apply and test locally',
            body: [
              '**`iif lo accept`** keeps **`curl 127.0.0.1:9100`** working. **`ct state established,related accept`** lets DNS and HTTPS replies return under default deny. Outbound stays allowed on the output chain.',
            ],
            code: {
              language: 'shell',
              code: `sudo nft -c -f /etc/nftables.conf
sudo systemctl enable --now nftables
sudo nft list ruleset

curl -s http://127.0.0.1:9100/health
curl -s http://127.0.0.1:6379/health
curl -sI https://deb.debian.org | head -1`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: 'Do not flush a remote firewall to “test”',
          body: [
            'A broad reset can lock you out of SSH or expose every debug port. Add the narrow rule, check syntax, then load.',
          ],
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['My address / route / DNS server', '`ip -4 addr`, `ip route`, `cat /etc/resolv.conf`'],
            ['What programs resolve', '`getent hosts name`'],
            ['What DNS alone says', '`dig +short name`'],
            ['Who listens here', '`sudo ss -tlnp`'],
            ['HTTP check', '`curl -v URL`'],
            ['TCP only', '`nc -vz host port`'],
            ['List / check nftables', '`sudo nft list ruleset`, `sudo nft -c -f /etc/nftables.conf`'],
            ['Load firewall at boot', '`sudo systemctl enable --now nftables`'],
          ],
        },
      },
    ],
    takeaways: [
      'Debug **bottom-up**: address → name → listener → request. Test from the failing host.',
      '**`getent hosts`** matches what apps use. **`dig`** skips **`/etc/hosts`**. Wrong **`getent`**, empty **`dig`** → fix hosts or DNS, not the firewall.',
      '**`ss -tlnp`** shows the real bind address and port. A running service on the wrong port is still a failure.',
      'Host firewalls should be **default deny** with loopback, established replies, and only the ports you mean to publish. Keep SSH allowed before you drop.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-20-why-cant-order-reach-payment', label: "Why Can't Order Reach Payment?" },
      { challengeId: 'linux-21-open-only-the-right-ports', label: 'Open Only the Right Ports' },
    ],
  },
  {
    id: 'ssh-keys-and-login',
    slug: 'ssh-keys-and-login',
    trackId: 'B12',
    eyebrow: '',
    title: 'SSH Keys and Login',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-22-ssh-keys-for-the-deploy-bot',
    lede:
      '**SSH** gives you an encrypted terminal on another Linux machine. This post starts with a normal login, explains host identity, builds a public/private **key pair**, installs the public key safely, and troubleshoots the permissions and configuration that commonly break key authentication.',
    sections: [
      {
        id: 'what-ssh-does',
        title: 'SSH: a secure remote shell',
        body: [
          'When you run **`ssh student@server`**, the `ssh` **client** on your machine opens an encrypted connection to the SSH **server** (`sshd`) on the remote machine. After authentication, the server starts a shell as the requested user. Commands run on the remote machine, not on your laptop.',
          'SSH protects the connection from being read or changed in transit. It still has to answer two identity questions: **is this really the server I intended to reach?** and **am I allowed to log in as this user?** Host keys answer the first; a password or user key answers the second.',
        ],
        flows: [
          {
            title: 'One SSH login',
            steps: [
              'Connect to host and port',
              'Verify the server host key',
              'Authenticate the user',
              'Start an encrypted remote shell',
            ],
          },
        ],
        code: {
          language: 'shell',
          code: `ssh student@server.example
ssh -p 2222 student@server.example  # non-default SSH port
hostname                            # runs remotely after login
exit                                # close the remote shell`,
        },
      },
      {
        id: 'host-keys',
        title: 'First connection: verify the server',
        body: [
          'The first time you connect, SSH shows the server’s **host-key fingerprint** and asks whether to trust it. Compare that fingerprint with a value from a trusted source — your cloud console, administrator, or provisioning output — before answering `yes`.',
          'Once accepted, the client stores the host key in **`~/.ssh/known_hosts`**. Future connections compare the presented key with that saved value. A loud “REMOTE HOST IDENTIFICATION HAS CHANGED” warning can mean a server was rebuilt, but it can also mean traffic is being intercepted; verify the new fingerprint before replacing the entry.',
        ],
        code: {
          language: 'shell',
          code: `ssh-keygen -F server.example        # show saved host-key entries
ssh-keyscan server.example           # fetches a key; does NOT prove it is trusted
ssh-keygen -R server.example         # remove old entry only after verification`,
        },
        callout: {
          kind: 'warn',
          title: 'Do not blindly accept a changed host key',
          body: [
            'Confirm why it changed and compare the new fingerprint through a separate trusted channel. Deleting `known_hosts` removes the warning, not the risk.',
          ],
        },
      },
      {
        id: 'passwords-vs-keys',
        title: 'User authentication: passwords and keys',
        body: [
          'A password proves identity by sending knowledge of one secret through the encrypted connection. It is easy for a person to use, but weak passwords can be guessed and automation has to store the password somewhere.',
          'A key login uses a **key pair**. The public key is installed on the server. The private key remains with the client. During login, the client proves it possesses the private key without sending that private key across the network.',
        ],
        table: {
          headers: ['Item', 'Where it belongs', 'Can it be shared?'],
          rows: [
            ['Public key (`.pub`)', 'Remote account’s `~/.ssh/authorized_keys`', 'Yes, with systems you want to access'],
            ['Private key (no `.pub`)', 'Your machine, agent, or protected CI secret', 'No'],
            ['Private-key passphrase', 'Known by the operator / unlocked in an agent', 'No'],
            ['Server host private key', 'On the SSH server', 'No'],
            ['Public host key / fingerprint', 'Distributed to clients for verification', 'Yes, through a trusted channel'],
          ],
        },
      },
      {
        id: 'generate-key',
        title: 'Generate a key pair',
        body: [
          '**Ed25519** is a strong, compact default on current systems. **`ssh-keygen`** creates two files: the private key at the path you choose and a public key with `.pub` appended. The comment is only a label that helps humans identify the key.',
          'Use a passphrase for an interactive human key. It encrypts the private-key file at rest, so stealing the file alone is not enough. Automation may require a different protected setup, but should still use a dedicated key with the smallest necessary access.',
        ],
        code: {
          language: 'shell',
          code: `ssh-keygen -t ed25519 -f ~/.ssh/devsetu_lab -C "asha laptop"
ls -l ~/.ssh/devsetu_lab*
ssh-keygen -lf ~/.ssh/devsetu_lab.pub  # show public-key fingerprint
cat ~/.ssh/devsetu_lab.pub             # safe public line to install`,
        },
        callout: {
          kind: 'warn',
          title: 'The file without .pub is private',
          body: [
            'Never paste it into chat, tickets, logs, or source control. If a private key may have leaked, remove its public key from every server and create a new pair.',
          ],
        },
      },
      {
        id: 'install-public-key',
        title: 'Install the public key on the server',
        body: [
          'The remote account accepts user keys listed in **`~/.ssh/authorized_keys`**, one public key per line. **`ssh-copy-id`** logs in using an existing method (often a password), creates the files, appends the public key, and normally fixes permissions.',
        ],
        code: {
          language: 'shell',
          code: `ssh-copy-id -i ~/.ssh/devsetu_lab.pub student@server.example
ssh -i ~/.ssh/devsetu_lab student@server.example`,
        },
        subsections: [
          {
            id: 'manual-install',
            title: 'Manual installation',
            body: [
              'If `ssh-copy-id` is unavailable, append the **single public-key line** while logged in through an existing trusted session. `umask 077` ensures newly created files are private.',
            ],
            code: {
              language: 'shell',
              code: `# Run on the remote server as the target user:
umask 077
mkdir -p ~/.ssh
cat >> ~/.ssh/authorized_keys
# paste the one-line contents of devsetu_lab.pub, then press Ctrl-D
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys`,
            },
          },
          {
            id: 'permissions-owner',
            title: 'Permissions and ownership matter',
            body: [
              '`sshd` may reject `authorized_keys` if the home directory, `.ssh`, or the file can be changed by other users. The target user should own them; `.ssh` should normally be **700** and `authorized_keys` **600**.',
            ],
            code: {
              language: 'shell',
              code: `ls -ld ~ ~/.ssh ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chown -R "$USER":"$(id -gn)" ~/.ssh`,
            },
          },
        ],
      },
      {
        id: 'using-keys',
        title: 'Use keys without a long command',
        body: [
          '**`-i`** selects a private identity file. For hosts you use often, put the settings in **`~/.ssh/config`** and give the connection a short alias. The config file should be readable and writable only by you.',
        ],
        codes: [
          {
            language: 'ssh-config',
            filename: '~/.ssh/config',
            code: `Host orders-stage
  HostName stage.example.com
  User deploy
  Port 22
  IdentityFile ~/.ssh/orders_stage
  IdentitiesOnly yes`,
          },
          {
            language: 'shell',
            code: `chmod 600 ~/.ssh/config
ssh orders-stage
ssh -G orders-stage | less  # print the final configuration SSH will use`,
          },
        ],
        subsections: [
          {
            id: 'agent',
            title: 'ssh-agent: unlock once per session',
            body: [
              '**`ssh-agent`** keeps an unlocked private key in memory so you do not type its passphrase for every connection. Desktop environments often start an agent already. **`ssh-add`** loads a key and **`ssh-add -l`** lists loaded fingerprints.',
            ],
            code: {
              language: 'shell',
              code: `ssh-add ~/.ssh/devsetu_lab
ssh-add -l
ssh student@server.example`,
            },
          },
        ],
      },
      {
        id: 'copy-files',
        title: 'Copy files over SSH',
        body: [
          '**`scp`** copies a file or directory through SSH. **`rsync`** is better for repeated transfers because it compares source and destination and sends only changes. A colon separates the remote host from its path.',
        ],
        code: {
          language: 'shell',
          code: `scp report.txt student@server.example:/tmp/
scp student@server.example:/var/log/app.log .
scp -r release/ student@server.example:/opt/app/
rsync -av --progress release/ student@server.example:/opt/app/`,
        },
        callout: {
          kind: 'tip',
          title: 'Watch the trailing slash in rsync',
          body: [
            '`rsync release/ host:/opt/app/` copies the **contents** of `release`. Without the source slash, it creates `/opt/app/release`.',
          ],
        },
      },
      {
        id: 'automation',
        title: 'Keys for automation',
        body: [
          'A deploy bot should have its own remote user and its own key pair; never copy a person’s private key into CI. Store the private key in the CI platform’s protected secret store, limit who can read it, and rotate it.',
          'An `authorized_keys` entry can be restricted with options such as `from=` (allowed source addresses), `command=` (one forced command), and disabling forwarding or pseudo-terminals. Apply restrictions only after testing the exact automation flow.',
        ],
        code: {
          language: 'text',
          code: `from="10.20.0.0/16",no-agent-forwarding,no-port-forwarding,no-pty ssh-ed25519 AAAA... deploy-bot`,
        },
      },
      {
        id: 'ssh-debugging',
        title: 'When key login fails',
        body: [
          'Add **`-v`** for diagnostic output (`-vvv` for more detail). It shows which config files were read, which keys were offered, whether the server accepted one, and where authentication stopped. The private key contents are not printed.',
        ],
        code: {
          language: 'shell',
          code: `ssh -v -i ~/.ssh/devsetu_lab student@server.example
ssh -G server.example | grep -E '^(user|hostname|port|identityfile) '
sudo journalctl -u ssh -n 50 --no-pager   # Ubuntu/Debian server
sudo journalctl -u sshd -n 50 --no-pager  # many other distributions`,
        },
        table: {
          headers: ['Symptom', 'Likely check'],
          rows: [
            ['`Permission denied (publickey)`', 'Correct remote user, key offered, public line installed'],
            ['Key offered but rejected', '`authorized_keys` content, ownership, and permissions'],
            ['Connection refused', '`sshd` state, listener, host, and port'],
            ['Connection timed out', 'Route and firewall before authentication'],
            ['Host identification changed', 'Verify the server’s new host-key fingerprint'],
            ['Too many authentication failures', 'Use `IdentitiesOnly yes` with the intended key'],
          ],
        },
      },
      {
        id: 'ssh-quick-reference',
        title: 'Quick reference',
        body: [],
        tableAfter: {
          headers: ['Goal', 'Command'],
          rows: [
            ['Log in', '`ssh user@host`'],
            ['Use a chosen key / port', '`ssh -i key -p port user@host`'],
            ['Create an Ed25519 pair', '`ssh-keygen -t ed25519 -f path`'],
            ['Install a public key', '`ssh-copy-id -i key.pub user@host`'],
            ['Load / list agent keys', '`ssh-add key`, `ssh-add -l`'],
            ['Debug negotiation and authentication', '`ssh -v user@host`'],
            ['Copy a file', '`scp file user@host:/path/`'],
            ['Sync a directory', '`rsync -av source/ user@host:/path/`'],
            ['Inspect final client config', '`ssh -G alias`'],
          ],
        },
      },
    ],
    takeaways: [
      'SSH verifies both sides: the client checks the server’s **host key**, and the server authenticates the requested **user**.',
      '**`ssh-keygen`** creates a pair. Install only the **public** `.pub` line in `authorized_keys`; the private key never leaves its protected client or secret store.',
      'Use **`~/.ssh/config`** for repeatable host settings and **`ssh-agent`** to cache an unlocked human key in memory.',
      'When login fails, use **`ssh -v`** and check the remote user, offered identity, `authorized_keys`, ownership, and permissions.',
      'Automation gets a dedicated user and key with the smallest practical permissions—not a copied personal key.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-22-ssh-keys-for-the-deploy-bot', label: 'SSH Keys for the Deploy Bot' },
    ],
  },
  {
    id: 'bash-scripting-basics',
    slug: 'bash-scripting-basics',
    trackId: 'B13',
    eyebrow: '',
    title: 'Bash Scripting Basics',
    showBlogStamp: true,
    gatedByChallengeId: 'linux-23-script-the-health-check',
    lede:
      'Before every deploy someone runs three **`curl`** commands by hand and guesses from the output. Last week that guess shipped onto a dead **payment-handler**. Partners also drop order-batch CSVs into a spool folder every morning for someone to count by spreadsheet. This post is how you turn both chores into **scripts** whose **exit codes** and loops a pipeline can trust.',
    sections: [
      {
        id: 'why-a-script',
        title: 'A file the computer can trust',
        body: [
          'A script is a text file of commands Bash runs top to bottom. Put the steps in a file when the same check must run from a deploy pipeline, cron, or another engineer’s hands — and when the **exit code** must say pass or fail without eyeballing JSON.',
          'The first line is the **shebang**: **`#!/bin/bash`** or **`#!/usr/bin/env bash`**. Make the file executable once with **`chmod +x`**, then run it with **`./name`** or put it on your **`PATH`**.',
        ],
        code: {
          language: 'shell',
          code: `cat > /tmp/hello.sh <<'EOF'
#!/bin/bash
echo "$(date -Is) hello from $(hostname)"
EOF
chmod +x /tmp/hello.sh
/tmp/hello.sh`,
        },
        callout: {
          kind: 'tip',
          title: 'Unix line endings',
          body: [
            'A script copied from Windows can fail with **`bash\\r: No such file or directory`**. Save with LF endings, or run **`dos2unix`**.',
          ],
        },
      },
      {
        id: 'variables-args',
        title: 'Variables, quoting, and arguments',
        body: [
          'Assign with **no spaces** around **`=`**. Read with **`"$name"`** or **`"${name}"`**. Double quotes keep the value one argument after spaces. Single quotes stay literal. Unquoted expansions split on spaces — quote by default.',
          '**`$1`** is the first argument, **`$#`** is how many you got, **`"$@"`** is all of them as separate words. **`\${1:-default}`** uses a default when the argument is missing or empty.',
        ],
        code: {
          language: 'shell',
          code: `name="order processor"
port=8080
url="http://127.0.0.1:\${port}/health"
echo "$name → $url"

# Inside a script:
# url="\${1:-http://127.0.0.1:8080/health}"`,
        },
        subsections: [
          {
            id: 'usage-errors',
            title: 'Reject bad usage on stderr',
            body: [
              'Print **usage** and errors to **stderr** (**`>&2`**). Keep **stdout** for the result a pipeline might parse. Exit with a specific non-zero code so callers can tell “bad args” from “service down.”',
            ],
            code: {
              language: 'shell',
              code: `if [ $# -ne 1 ]; then
  echo "usage: check-health <service>" >&2
  exit 2
fi`,
            },
          },
        ],
        callout: {
          kind: 'warn',
          title: 'Make "$var" a reflex',
          body: [
            'A file named **`batch 0002 (retry).csv`** becomes several arguments when **`$f`** is unquoted. Write **`"$f"`** unless you deliberately want splitting or globs.',
          ],
        },
      },
      {
        id: 'exit-and-tests',
        title: 'Exit codes and tests',
        body: [
          'Every command returns a small integer: **0** means success, anything else means failure. Cron, systemd, and CI read that number. Prefer **`if command; then`** over saving **`$?`** and checking it later.',
          '**`[[ ... ]]`** tests files and strings in Bash. **`(( ... ))`** does integer math and comparisons.',
        ],
        table: {
          headers: ['Test', 'True when'],
          rows: [
            ['`[[ -f "$path" ]]`', 'Regular file'],
            ['`[[ -d "$path" ]]`', 'Directory'],
            ['`[[ -z "$value" ]]` / `-n`', 'Empty / non-empty string'],
            ['`[[ "$a" == "$b" ]]`', 'Strings equal'],
            ['`(( n > 0 ))`', 'Integer comparison'],
          ],
        },
        code: {
          language: 'shell',
          code: `if curl -fsS --max-time 3 "$url" >/dev/null; then
  echo "OK"
  exit 0
else
  echo "DOWN"
  exit 1
fi`,
        },
      },
      {
        id: 'health-script',
        title: 'Script the health check',
        body: [
          'Service ports live in **`/etc/order-platform/services`** (name and port). The deploy pipeline needs **`/usr/local/bin/check-health <name>`**: look up the port, **`curl`** **`http://127.0.0.1:<port>/health`**, print **`<name> OK`** or **`DOWN`**, and exit **0** / **1**. Wrong args → exit **2**. Unknown name → exit **3**. Do not hard-code ports — the grader adds services later.',
        ],
        subsections: [
          {
            id: 'check-health-body',
            title: 'The script',
            body: [
              '**`awk`** picks the port for an exact name. **`curl -f`** treats HTTP errors as failure. **`chmod 755`** so any user can run it.',
            ],
            code: {
              language: 'shell',
              filename: '/usr/local/bin/check-health',
              code: `#!/bin/bash
# check-health <service> — exit 0 OK, 1 DOWN, 2 usage, 3 unknown.
registry=/etc/order-platform/services

if [ $# -ne 1 ]; then
  echo "usage: check-health <service>" >&2
  exit 2
fi
name="$1"

port="$(awk -v n="$name" '$1 == n {print $2}' "$registry")"
if [ -z "$port" ]; then
  echo "unknown service: $name" >&2
  exit 3
fi

if curl -fsS --max-time 3 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
  echo "$name OK"
  exit 0
else
  echo "$name DOWN"
  exit 1
fi`,
            },
          },
          {
            id: 'try-health',
            title: 'Try the exit codes',
            body: [
              'Install it, then exercise every path. **`bash -x`** traces expansions when a check misbehaves.',
            ],
            code: {
              language: 'shell',
              code: `sudo tee /usr/local/bin/check-health >/dev/null <<'EOF'
# paste the script
EOF
sudo chmod 755 /usr/local/bin/check-health

check-health; echo "exit=$?"
check-health order-processor; echo "exit=$?"
check-health notification-service; echo "exit=$?"
check-health inventory-service; echo "exit=$?"
bash -x /usr/local/bin/check-health order-processor`,
            },
          },
        ],
      },
      {
        id: 'loops-functions',
        title: 'Loop over order batches',
        body: [
          'Partners drop CSVs into **`$ORDER_SPOOL/incoming/`**. Each file has a header plus one order per line. Some names contain spaces. Every morning: print **`<file> <count>`**, move the file to **`processed/`**, then print **`TOTAL <sum>`**.',
          'A **`for`** loop walks a list. A **function** names one step so the loop stays readable. **`shopt -s nullglob`** makes an unmatched **`*.csv`** expand to nothing instead of a literal filename.',
        ],
        subsections: [
          {
            id: 'process-batches',
            title: 'process-batches',
            body: [
              '**`\${ORDER_SPOOL:-/var/spool/orders}`** uses the environment when set. **`wc -l`** counts lines; subtract one for the header. Quote **`"$f"`** every time.',
            ],
            code: {
              language: 'shell',
              filename: '~/bin/process-batches',
              code: `#!/bin/bash
# process-batches — count and archive CSVs from $ORDER_SPOOL/incoming.
spool="\${ORDER_SPOOL:-/var/spool/orders}"

count_orders() {
  local lines
  lines=$(wc -l < "$1")
  echo $((lines - 1))
}

shopt -s nullglob
total=0
for f in "$spool"/incoming/*.csv; do
  n=$(count_orders "$f")
  echo "$(basename "$f") $n"
  total=$((total + n))
  mv "$f" "$spool/processed/"
done
echo "TOTAL $total"`,
            },
          },
          {
            id: 'bashrc-path',
            title: 'PATH and ORDER_SPOOL in ~/.bashrc',
            body: [
              '**`~/.bashrc`** runs for interactive shells. Put **`~/bin`** on your **`PATH`** and export **`ORDER_SPOOL`** there. **`source ~/.bashrc`** applies it to the current shell. Scripts you ship for cron should still set their own defaults — they do not read your bashrc.',
            ],
            code: {
              language: 'shell',
              code: `mkdir -p ~/bin
chmod +x ~/bin/process-batches

cat >> ~/.bashrc <<'EOF'
export PATH="$HOME/bin:$PATH"
export ORDER_SPOOL=/var/spool/orders
EOF
source ~/.bashrc
command -v process-batches
# /home/learner/bin/process-batches
process-batches
# batch-0001.csv 17
# batch 0002 (retry).csv 31
# TOTAL 48`,
            },
          },
        ],
        callout: {
          kind: 'tip',
          title: 'local inside functions',
          body: [
            'Declare scratch variables with **`local`** inside a function so they do not overwrite names in the rest of the script.',
          ],
        },
      },
      {
        id: 'safer-debug',
        title: 'Safer defaults and debugging',
        body: [
          '**`set -u`** errors on unset variables. **`set -o pipefail`** fails a pipeline if any stage fails. **`set -e`** exits on many failures but has exceptions inside **`if`**, **`&&`**, and **`||`** — test failure paths on purpose.',
          '**`bash -n script`** checks syntax without running. **`bash -x`** prints each expanded command; avoid tracing secrets. **ShellCheck** catches quoting mistakes when it is installed.',
        ],
        code: {
          language: 'shell',
          code: `bash -n ~/bin/process-batches
bash -x ~/bin/process-batches
shellcheck /usr/local/bin/check-health   # if installed`,
        },
      },
      {
        id: 'quick-reference',
        title: 'Quick reference',
        body: ['The decisions are above. This is the command for each one.'],
        tableAfter: {
          headers: ['Goal', 'Syntax'],
          rows: [
            ['Shebang / run', '`#!/bin/bash`, `chmod +x`, `./script`'],
            ['Safe expand', '`"$var"`, `"${var}_x"`, `"$(cmd)"`'],
            ['Args', '`$1`, `$#`, `"$@"`, `\${1:-default}`'],
            ['Stderr + exit', '`echo msg >&2; exit 2`'],
            ['Branch on command', '`if cmd; then …; else …; fi`'],
            ['Tests', '`[[ -f "$p" ]]`, `(( n > 0 ))`'],
            ['Function', '`name() { local x="$1"; …; }`'],
            ['Glob loop', '`shopt -s nullglob; for f in dir/*.csv; do …; done`'],
            ['Default env', '`\${ORDER_SPOOL:-/var/spool/orders}`'],
            ['Interactive PATH', '`export PATH="$HOME/bin:$PATH"` in `~/.bashrc`'],
            ['Check / trace', '`bash -n`, `bash -x`, `shellcheck`'],
          ],
        },
      },
    ],
    takeaways: [
      'A script is a repeatable sequence with a **shebang**, **`chmod +x`**, and meaningful **exit codes** callers can automate on.',
      'Quote **`"$var"`**. Send usage and errors to **stderr**. Read ports and paths from config or the environment instead of hard-coding.',
      '**Functions** name steps; **loops** plus **`nullglob`** handle any number of files, including names with spaces.',
      'Put personal **`PATH`** and exports in **`~/.bashrc`**. Keep production scripts self-contained. Debug with **`bash -n`** and **`bash -x`**.',
    ],
    relatedLabsIntro: '',
    relatedLabs: [
      { challengeId: 'linux-23-script-the-health-check', label: 'Script the Health Check' },
      { challengeId: 'linux-24-loop-over-order-batches', label: 'Loop Over Order Batches' },
    ],
  },
];
