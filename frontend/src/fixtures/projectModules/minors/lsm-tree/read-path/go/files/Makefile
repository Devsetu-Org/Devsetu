.PHONY: test race run vet

# This chapter: Bloom, merging iterator, filter hooks, scan.
PACKAGES := ./internal/bloom/... ./internal/iterator/... ./internal/sstable/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/lsmkv

vet:
	go vet $(PACKAGES)
