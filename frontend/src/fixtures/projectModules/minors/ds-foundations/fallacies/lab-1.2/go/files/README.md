# ridernet — Lab 1.2 · The Constrained Network

Soft driver location spam on a narrow link. This lab is only about thinning
location updates so strong trip RPCs are not starved.

```
internal/location/coalesce.go       Coalesce <- TODO(1.2)
internal/location/coalesce_test.go  acceptance tests (given)
```

No dispatch client and no Lab 1.1 retry code here — on purpose.

## Running

```
make test
make race
```
