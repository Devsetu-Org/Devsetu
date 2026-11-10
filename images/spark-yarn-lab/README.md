# spark-yarn-lab

Lab image for Platforms Engineer → Spark Chapter 2 (Spark on YARN).

Contains:

- Hadoop **3.3.6** (ResourceManager / NodeManager)
- Spark **3.5.3** (Hadoop 3 build)
- Join job + sample CSVs under `/opt/lab`
- Helper scripts under `/opt/lab/bin`

Default tag: `devsetu/spark-yarn-lab:v0.1`

```bash
# from repo root
./images/build-all.sh spark-yarn-lab
# or local single-arch
docker build -t devsetu/spark-yarn-lab:v0.1 images/spark-yarn-lab
```

Runtime override: `SPARK_YARN_LAB_IMAGE=devsetu/spark-yarn-lab:v0.1`
