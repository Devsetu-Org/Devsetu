# Solution — DNS, Memory, and Disk Triple

1. Remove `spark.driver.host=broken-host.quickbite.invalid` from shell `spark-defaults.conf` (or set to `$(hostname)`).
2. Change `spark.executor.memoryOverhead` from `48m` to `128m`.
3. `rm -f $SPARK_HOME/work/spark-local/DISK_FILLER` on both Workers.
4. Re-run `store-rollup-triple` (pass `--conf spark.executor.memoryOverhead=128m` if needed) → `STATUS=ok`.
