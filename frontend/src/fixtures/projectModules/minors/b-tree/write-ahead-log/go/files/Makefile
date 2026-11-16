.PHONY: test race run vet

# This chapter's acceptance tests only — not chapters 1–2.
PACKAGES := ./internal/wal/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/btreekv

vet:
	go vet $(PACKAGES)
