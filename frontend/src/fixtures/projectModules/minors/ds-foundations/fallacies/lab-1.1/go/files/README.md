# ridernet — Lab 1.1 · The Unreliable, Slow Network

Fleetline dispatch client over an in-process simulated network. This lab is only about
bounded retries when the network drops a trip hop.

```
cmd/dispatchdemo/main.go       demo: naive vs reliable under loss (given)
internal/netsim/               drop + delay RPC network (given)
internal/dispatch/             TripHop handler (given)
internal/client/client.go      CallOnce (given) · Call <- TODO(1.1)
internal/client/client_test.go acceptance tests (given)
```

## Your work

Implement `Client.Call` with bounded retries. Leave `CallOnce` alone.

## Running

```
make test     # go test ./internal/...
make race     # same, with the race detector
make run      # print naive vs reliable success rates under 20% loss
```
