.PHONY: test race run vet

# This chapter: compaction merge, manifest, compact.
PACKAGES := ./internal/compaction/... ./internal/manifest/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/lsmkv

vet:
	go vet $(PACKAGES)
