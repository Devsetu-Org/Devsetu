.PHONY: test race run vet

# This chapter: pager only.
PACKAGES := ./internal/pager/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

run:
	go run ./cmd/btreekv

vet:
	go vet $(PACKAGES)
