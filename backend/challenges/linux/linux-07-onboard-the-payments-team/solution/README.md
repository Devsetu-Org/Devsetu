Priya and Marco need logins on the payment box, and they need to restart **payment-handler** when it dies. That is the only thing they may do as root. Creating accounts and writing a sudo rule both change system files, so these commands use `sudo`.

A group lets one rule cover the whole team. Offboarding locks an account. It does not delete it.

| Command | What it does |
| --- | --- |
| `groupadd` | Creates a group |
| `useradd -m -s -G` | Creates a user, a home directory, a login shell, and extra groups |
| `visudo -f` | Edits a sudoers file and refuses to save it if the syntax is broken |
| `chmod 440` | Root can read the file, and sudo will accept it |
| `usermod -L -s` | Locks the password and changes the login shell |
| `passwd -S` | Shows whether the password is locked (`L`) |

## 1. Group and users

```bash
sudo groupadd payments-team
sudo useradd -m -s /bin/bash -G payments-team priya
sudo useradd -m -s /bin/bash -G payments-team,adm marco
id priya
id marco
```

`-m` creates the home directory. `-G` adds extra groups and leaves the user's own group in place.

## 2. The sudo rule

```bash
sudo visudo -f /etc/sudoers.d/payments-team
```

Put this line in the file:

```
%payments-team ALL=(root) NOPASSWD: /usr/bin/systemctl restart payment-handler, /usr/bin/systemctl status payment-handler
```

`%` means the rule is for the group. The paths are the full paths of the two commands, so a different `systemctl` on the path cannot slip through.

```bash
sudo chmod 440 /etc/sudoers.d/payments-team
sudo visudo -cf /etc/sudoers.d/payments-team
```

## 3. Offboard olek

```bash
sudo usermod -L -s /usr/sbin/nologin olek
sudo passwd -S olek
```

The second field of `passwd -S` is `L` when the password is locked. Leave `/home/olek` where it is.

Then **Submit**.
