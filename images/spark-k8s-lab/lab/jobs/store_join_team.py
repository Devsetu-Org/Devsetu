#!/usr/bin/env python3
"""Join job that requires the QuickBite lab image (/opt/lab/python)."""
import sys

sys.path.insert(0, "/opt/lab/python")
from quickbite_utils import TEAM_MARKER  # noqa: E402

from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()
print(f"TEAM_MARKER={TEAM_MARKER}")
orders = spark.read.csv("file:///opt/lab/data/orders.csv", header=True, inferSchema=True)
stores = spark.read.csv("file:///opt/lab/data/stores.csv", header=True, inferSchema=True)
joined = orders.join(stores, "store_id")
rollup = joined.groupBy("region").sum("amount")
rollup.orderBy("region").show(truncate=False)
spark.stop()
