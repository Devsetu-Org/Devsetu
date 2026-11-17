.PHONY: test race run vet

# This chapter's acceptance tests only — not chapter 1's memtable suite.
PACKAGES := ./internal/wal/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/lsmkv

vet:
	go vet $(PACKAGES)
