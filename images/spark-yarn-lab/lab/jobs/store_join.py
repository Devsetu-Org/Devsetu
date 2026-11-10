#!/usr/bin/env python3
"""Multi-stage join used by Spark Chapter 2 labs (same idea as Lab 1.3)."""
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder.appName("store-rollup-join")
    .getOrCreate()
)

orders = spark.read.csv("/opt/lab/data/orders.csv", header=True, inferSchema=True)
stores = spark.read.csv("/opt/lab/data/stores.csv", header=True, inferSchema=True)
joined = orders.join(stores, "store_id")
rollup = joined.groupBy("region").sum("amount")
rollup.orderBy("region").show(truncate=False)
spark.stop()
