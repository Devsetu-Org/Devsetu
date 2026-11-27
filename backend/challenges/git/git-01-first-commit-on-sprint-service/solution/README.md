# Solution — Clone, Commit, and Push

Core's git host is **git.forgeboard.internal**. Clone over SSH, change config,
commit, and push. The brief (including which tenants to flip) is in the
**Description** tab.

## 1. Clone into your home directory

Nothing is pre-placed under `~/sprint-service`. Clone from home so Git creates
the folder for you:

```bash
cd ~
git clone learner@git.forgeboard.internal:/srv/git/sprint-service.git
cd sprint-service
git remote -v
git log --oneline
```

One commit from Priya. `origin` points at `learner@git.forgeboard.internal:...`.

## 2. Configure your identity

Git refuses to commit without a name and email:

```bash
git config --global user.name "Ada Learner"
git config --global user.email "ada@forgeboard.internal"
git config --global --list | grep user
```

## 3. Edit the config

Flip only **helix-robotics** and **lumen-retail** to `full`. Leave
`agentic_sprints_default` and every other tenant on `beta`.

```bash
nano config/app.conf
git diff
```

`git diff` should show exactly two changed lines under `[agentic_sprints.tenants]`.

## 4. Stage, commit, and push

```bash
git add config/app.conf
git commit -m "Enable full agentic sprints for early-access enterprises"
git push origin main
git status
git log --oneline
```

Then **Submit**. The grader checks identity, your local commit, that only those
two tenant flags changed, and that **remote `main` matches your HEAD**.
