# Kubernetes (GKE) — Spring `sync-service`

For the assignment **GKE + Spring Boot** path: build the image from [`sync-service-spring`](../sync-service-spring) (Jenkins does this when that module is the Docker context), then deploy to **GKE Autopilot** (optional Terraform: `enable_gke = true` in `terraform/`) or any GKE cluster.

## Ingress & TLS (typical)

- **GCE Ingress** with `Ingress` + `Service` `type: NodePort` or `ClusterIP` + BackendConfig; managed certs via **Certificate Manager** or cert-manager, **or**  
- **Gateway API** / internal-only + **IAP** for admin APIs.

## Apply manifests (replace image)

```bash
# Cluster credentials (Autopilot in us-central1)
gcloud container clusters get-credentials GKE_NAME --region us-central1 --project YOUR_PROJECT

export SYNC_IMAGE=us-central1-docker.pkg.dev/PROJECT/sync-service/sync-service:GIT_SHA
envsubst < deployment.yaml | kubectl apply -f -
# Or edit deployment.yaml image: line first.
```

Files:

- `namespace.yaml` — `sync-service` namespace  
- `deployment.yaml` — Spring Boot replica set, `SPRING_PROFILES_ACTIVE`, `MONGODB_URI` from Secret  
- `service.yaml` — `ClusterIP` (front with Ingress / Gateway in your org)  
- `hpa.yaml` — **horizontal pod autoscaling** (CPU) — aligns with “auto-scaling” in Part 2  

**Secrets:** create from Secret Manager or `kubectl create secret generic sync-mongo --from-literal=uri=...` and reference in deployment.

**Rolling update:** `Deployment` strategy `RollingUpdate` with `maxSurge` / `maxUnavailable` — see Part 1 doc. **Rollback:** `kubectl rollout undo deployment/sync-service` or pin previous image digest in deployment.

## Relation to Part 1 / Part 2

- **Jenkins** can run `gcloud deploy` to Cloud Run (python sample) **or** `kubectl set image` / `kubectl apply` when targeting GKE (see root `Jenkinsfile` and `docs/CI_CD_DESIGN.md`).  
- **INFRA**: Cloud Run *or* GKE is justified in `docs/INFRASTRUCTURE.md` (GKE for org Kubernetes standard; Cloud Run for lowest ops / cost at startup).
