# Solution — Restore the Deleted Notify Format Helper

`format_notify_payload` was removed in a cleanup that also changed other files. Inspect that commit; restore **only** `src/notify_format.py` onto `fix/restore-notify-format` and push — leave `main` alone.

```bash
cd ~/sprint-service
git log -S'format_notify_payload' --oneline
git show <delete-sha>    # notice other paths changed too
git switch -c fix/restore-notify-format
git restore --source=<delete-sha>^ -- src/notify_format.py
git add src/notify_format.py
git commit -m "Restore format_notify_payload for board-notify webhooks"
git push -u origin fix/restore-notify-format
```

Reverting the whole cleanup would bring the helper back and undo the other edits Core wants to keep — that fails the grader.
