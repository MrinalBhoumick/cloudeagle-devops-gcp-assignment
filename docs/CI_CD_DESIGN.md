# Part 1 — Deployment & CI/CD Design (sync-service)

## Context

- **Service:** Spring Boot `sync-service`, connects to MongoDB, containerized, deployed on GCP.  
- **Environments:** `qa`, `staging`, `prod`.  
- **Build system:** Jenkins.  

This document describes branching, pipeline behavior, configuration and secrets, deployment strategy, and rollback.

---

## 1. Branching strategy

We use a **trunk-based** variant with long-lived environment branches, aligned with your three environments.

| Branch / pattern   | Purpose              | Deployment target   |
|--------------------|----------------------|----------------------|
| `main`             | production releases  | `prod` only          |
| `release/*`        | release candidates   | `staging`            |
| `develop`          | integration          | `qa`                 |
| `feature/*`, `bugfix/*` | short-lived   | *No auto-deploy*     |
| `hotfix/*`         | urgent prod fixes    | `prod` (after review + approval) |

**How branches map to environments**

- **QA:** Merges to `develop` trigger a deploy to the **QA** project/namespace.  
- **Staging:** Merges to `release/*` (e.g. `release/2026.04.22`) or a tagged commit from `develop` into `release/*` trigger **Staging**.  
- **Prod:** Only merges to `main` (or fast-forward of `main` from an approved `release/*`) trigger **Prod** — *never* from `develop` directly.

**Avoiding accidental production deployments**

1. **Branch protection on `main`:** require PR, reviews, and passing status checks; restrict who can merge.  
2. **Jenkins `when { branch 'main' }` (or tag-based prod)** so prod deploy stages **do not run** on `develop` or `feature/*`.  
3. **Separate GCP projects** (or at least separate Cloud Run services + distinct service accounts) for `qa` / `staging` / `prod` so a wrong job cannot hit prod by misconfiguration.  
4. **Manual approval gate** in Jenkins for `prod` (e.g. `input` step or a dedicated approver in your orchestration).  
5. **Immutable version tags** for prod images: deploy only `sync-service:1.2.3`, not `latest`.  
6. **Secrets and kube/config:** prod uses a dedicated **Credential** in Jenkins; QA/staging use different creds; pipeline selects by branch name, not by a single shared default.

---

## 2. Jenkins pipeline — high level

A reference implementation is in the repository root: [`Jenkinsfile`](../Jenkinsfile).

### Stages (conceptual)

1. **Checkout** — clone and record commit SHA, branch name, and tag (if any).  
2. **Build & unit tests** — Maven/Gradle: `test`, static analysis (optional: SpotBugs, Checkstyle).  
3. **Package** — build Spring Boot JAR, then build **Docker image** with a deterministic tag: `${GIT_COMMIT_SHORT}`.  
4. **Image push** — push to **Google Artifact Registry**; prod uses the same digest promoted from staging.  
5. **Deploy (environment-specific)**  
   - **PR:** *no* deploy to shared long-lived envs, or optional **ephemeral** preview (separate project / Cloud Run service name) if you add that later.  
   - **Merge to `develop`:** deploy to **QA** Cloud Run.  
   - **Merge to `release/*`:** deploy to **Staging**.  
   - **Merge to `main`:** after **manual approval**, deploy to **Prod**.  
6. **Smoke / health** — HTTP check on `/actuator/health` (or equivalent) against the deployed URL.  
7. **Post actions** — notify Slack/email; archive build metadata.

### What happens on **PR** vs **merge**

| Event | Pipeline behavior |
|--------|-------------------|
| **PR opened / updated** | Build, test, optional Docker build (no push to prod path), **no deploy to prod**. Optionally: push image to a `pr-*` tag for security scanning only. |
| **Merge to environment branch** | Full pipeline: build, test, push image, **deploy to the mapped environment** (prod only with approval on `main`). |

### Rollback if deployment fails

1. **Health check after deploy:** if `/actuator/health` fails N times, mark deploy failed.  
2. **Cloud Run revision rollback:** re-point traffic to the **previous ready revision** (kept because traffic is never 100% cut until the new revision is healthy, or you maintain last-known-good revision).  
3. **Artifact Registry:** previous image digest is still available — redeploy that digest with Terraform or `gcloud run services update` / Jenkins “rollback” job.  
4. **Terraform:** if infra is versioned, pin **image digest** in `terraform.tfvars` and `terraform apply` the previous value (or use a `rollback` job that sets the last good variable).  
5. **Database:** MongoDB schema migrations are **forward-compatible** and tested in staging; avoid destructive changes without a separate migration plan.

---

## 3. Configuration management

- **Per-environment config:** build-time and runtime.  
  - **Non-secrets:** Spring `application-qa.yml`, `application-staging.yml`, `application-prod.yml` packaged in the image **or** externalized as environment variables in Cloud Run. Prefer **one image**, **env-specific env vars** in GCP (or Secret Manager for sensitive URLs).  
- **Secrets (MongoDB URI, API keys):** not in Git, not in the image. Store in **Google Secret Manager**; mount or inject as env vars in Cloud Run; IAM restricts which service account can access which secret.  
- **Jenkins access:** use **GCP service account key** (short-lived, rotated) or **Workload Identity Federation** so Jenkins can push to Artifact Registry and update Cloud Run without long-lived static keys when possible.

---

## 4. Deployment strategy

**Choice: Rolling update on Cloud Run** (with revision-based traffic split when needed).

| Strategy    | fit for this service | Notes |
|------------|----------------------|--------|
| **Recreate** | Not ideal            | Downtime during cutover. |
| **Rolling**  | **Default** for Cloud Run | New revision gradually receives traffic; previous revision still warm. |
| **Blue/Green** | Optional for prod  | Use Cloud Run **traffic split** (e.g. 0% new → 100% new) after smoke tests, or two services (`sync-service-blue` / `green`) with DNS/load balancer. |

**Justification:** Cloud Run’s native deployment model is **atomic revisions + gradual traffic**; for most Spring Boot APIs this gives **zero planned downtime** without the operational overhead of two full GKE blue/green pools. For stricter org requirements, add **canary** (small % to new revision) or **full blue/green** with a load balancer in front of two services.

**Zero / minimal downtime**

- Health checks and **startup/liveness** probes.  
- **Min instances = 0** in QA to save cost; **min instances ≥ 1** in prod if cold starts are unacceptable.  
- **Connection pool tuning** to MongoDB so new instances do not overwhelm the database on spike.

---

## 5. Deliverable checklist

- [x] This design document (Markdown)  
- [x] `Jenkinsfile` in the repository root (declarative pipeline, parameterized, branch-aware)  

*Adjust branch names, credential IDs, and Cloud Run service names to match your org before running in production Jenkins.*
