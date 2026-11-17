.PHONY: test race run vet

# This chapter: SSTable + flush only.
PACKAGES := ./internal/sstable/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/lsmkv

vet:
	go vet $(PACKAGES)
