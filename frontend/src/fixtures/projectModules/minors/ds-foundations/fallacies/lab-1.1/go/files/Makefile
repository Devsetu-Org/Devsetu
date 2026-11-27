.PHONY: test race vet run

PACKAGES := ./internal/...

test:
	go test $(PACKAGES)

race:
	go test -race $(PACKAGES)

vet:
	go vet $(PACKAGES)

run:
	go run ./cmd/dispatchdemo
