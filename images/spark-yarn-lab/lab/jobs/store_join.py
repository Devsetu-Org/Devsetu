#!/usr/bin/env python3
"""Multi-stage join used by Spark Chapter 2 labs (same idea as Lab 1.3).

Do not hardcode appName here — spark-submit --name sets the YARN application
name (client and cluster). Paths are file:// so CSVs stay on the local image
disks when fs.defaultFS is HDFS (required for YARN jar staging across pods).
"""
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()

orders = spark.read.csv("file:///opt/lab/data/orders.csv", header=True, inferSchema=True)
stores = spark.read.csv("file:///opt/lab/data/stores.csv", header=True, inferSchema=True)
joined = orders.join(stores, "store_id")
rollup = joined.groupBy("region").sum("amount")
rollup.orderBy("region").show(truncate=False)
spark.stop()
