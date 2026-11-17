.PHONY: test race run vet

# This chapter: buffer pool + DB pool wiring (not chapters 1–3).
PACKAGES := ./internal/buffer/... ./internal/db/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/btreekv

vet:
	go vet $(PACKAGES)
