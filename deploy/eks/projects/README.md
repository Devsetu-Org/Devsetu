# Projects pool (`labs-projects`)

Shell capacity for **Projects** (minors / majors code chapters).

| Piece | Name |
| --- | --- |
| Managed base NG | `labs-projects` (`t4g.small`, arm64) |
| Karpenter overflow | `labs-projects-elastic` |
| Label / taint | `devlabs.io/pool=projects` |
| Image | `devsetu/projects-lab:v0.1` |
| Spike namespace | `dl-projects-spike` |

## You run (after cluster is up)

```bash
# 1. Build + push the image (multi-arch for Graviton)
./images/build-all.sh projects-lab

# 2. Base node
./deploy/eks/eks-projects.sh base

# 3. Optional elastic overflow (needs Karpenter)
./deploy/eks/eks-projects.sh up

# 4. Spike + capability checks
./deploy/eks/eks-projects.sh spike
./deploy/eks/eks-projects.sh check

# Park / tear down
./deploy/eks/eks-projects.sh sleep
./deploy/eks/eks-projects.sh down
```

Local image-only check (no EKS):

```bash
docker build -t devsetu/projects-lab:v0.1 images/projects-lab
./images/projects-lab/smoke-local.sh
```

## Density notes

`t4g.small` = 2 vCPU / 2 GiB. A projects box requests **100m / 256Mi** (limit 1 CPU / 768Mi). Expect roughly **~5 concurrent shells** per base node before memory pressure; elastic adds more `t4g.small` nodes when Pending.

## Network

Spike NetworkPolicy allows DNS + same-namespace only. **No public internet.** Package mirrors (Go / pip) can be added later the same way Docker uses `dl-mirror`.
