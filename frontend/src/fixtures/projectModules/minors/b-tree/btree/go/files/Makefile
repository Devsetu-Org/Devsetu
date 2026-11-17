.PHONY: test race run vet

# This chapter: B+ tree + DB API (not chapter 1's pager suite).
PACKAGES := ./internal/btree/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/btreekv

vet:
	go vet $(PACKAGES)
