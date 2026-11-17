.PHONY: test race bench run vet

# This chapter: memtable only.
PACKAGES := ./internal/memtable/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

bench:
	go test -run '^$$' -bench . ./internal/memtable

run:
	go run ./cmd/lsmkv

vet:
	go vet $(PACKAGES)
