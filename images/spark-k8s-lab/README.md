# spark-k8s-lab

Lab image for Platforms Engineer → Spark Chapter 3 (Spark on Kubernetes).

Contains:

- Spark **3.5.3** (from `apache/spark`)
- **kubectl** (learner forensics)
- Join job + sample CSVs under `/opt/lab`
- Team helper `quickbite_utils` under `/opt/lab/python` (Labs 17 / 20)

Default tag: `devsetu/spark-k8s-lab:v0.1`

```bash
# from repo root
./images/build-all.sh spark-k8s-lab
# or local single-arch
docker build -t devsetu/spark-k8s-lab:v0.1 images/spark-k8s-lab
```

Runtime override: `SPARK_K8S_LAB_IMAGE=devsetu/spark-k8s-lab:v0.1`
