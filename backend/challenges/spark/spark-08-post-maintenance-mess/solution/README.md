# Solution — Post-Maintenance Mess

1. Ignore `~/lab/MAINTENANCE_MASTER`. Use `$SPARK_MASTER_URL`.
2. On both Workers: `chmod 755 $SPARK_HOME/work`.
3. On Master + Workers: `rm -f $SPARK_HOME/work/eventlogs && mkdir -p $SPARK_HOME/work/eventlogs`.
4. Stop stale Workers; `start-worker.sh "$SPARK_MASTER_URL" --cores 2 --memory 1536m`.
5. Re-run `store-rollup-probe` → `STATUS=ok`.
