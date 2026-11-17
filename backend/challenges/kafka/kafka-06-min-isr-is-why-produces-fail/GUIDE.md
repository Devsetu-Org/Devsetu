# QuickBite — min.ISR is the write gate

`desk.alerts` is RF=2 / min.ISR=2 and `kafka-2` is down.

1. On **kafka-2**: `qb-broker start`
2. Recreate `desk.alerts` at RF 3 / min.ISR 2.
3. Do not set min.ISR=1. Prove produces succeed.
