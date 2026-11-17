# Solution — Lab 7

1. Timeline: pre-shuffle OK → shuffle FetchFailed.
2. Cause: spark-local filler + janitor wiping blockmgr/shuffle files.
3. Fix on both Workers: kill shuffle_janitor; rm DISK_FILLER; re-run store-rollup-shuffle → STATUS=ok.
