# Solution — The Partition and Replica Map

1. Describe `rider.dispatch`; configs for min.ISR / unclean.
2. Partition 0: leader, preferred (first replica), sorted ISR.
3. Predictions: A=`still-ok`, B=`produces-fail`, C=`produces-fail`.

On-cluster: `npx tsx challenges/kafka/_lib/validate-on-cluster.mjs kafka-04-the-partition-and-replica-map`
