# raftkv

A replicated key/value store built on Raft, in C++, built chapter by chapter.
This repo starts with leader election.

```
src/raft/election.cc          terms, candidates, leaders   <- TODO 1.1, 1.4, 1.5
src/raft/vote.cc              RequestVote                  <- TODO 1.2, 1.3
tests/raft_test.cc            acceptance tests (given)
```

## Running

```
make test
make asan
make run
```
