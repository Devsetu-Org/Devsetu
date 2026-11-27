# ridernet — Lab 1.3 · The Changing, Untrusted Network

Freshness checks for strong trip mutations. This lab is only about rejecting
stale and replayed confirms — not retries or location coalescing.

```
internal/session/accept.go       Guard.Accept <- TODO(1.3)
internal/session/accept_test.go  acceptance tests (given)
```

## Running

```
make test
make race
```
