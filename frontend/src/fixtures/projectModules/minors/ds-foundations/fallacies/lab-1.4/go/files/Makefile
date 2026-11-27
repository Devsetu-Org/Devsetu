.PHONY: test race vet

PACKAGES := ./internal/...

test:
	go test \$(PACKAGES)

race:
	go test -race \$(PACKAGES)

vet:
	go vet \$(PACKAGES)
