.PHONY: test race run vet

# This chapter: delete + scan (not chapters 1–4).
PACKAGES := ./internal/btree/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/btreekv

vet:
	go vet $(PACKAGES)
