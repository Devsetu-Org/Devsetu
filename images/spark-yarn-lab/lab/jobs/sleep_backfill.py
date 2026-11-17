#!/usr/bin/env python3
"""Long-running placeholder used to occupy a YARN queue in Chapter 2 labs."""
import time
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("queue-backfill").getOrCreate()
# Hold the ApplicationMaster / executors so capacity stays allocated.
time.sleep(3600)
spark.stop()
