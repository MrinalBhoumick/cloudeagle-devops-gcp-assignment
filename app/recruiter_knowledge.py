"""Grounding text aligned with the CloudEagle DevOps assignment (Parts 1 & 2). Used by the agent; keep factual and concise."""

RECRUITER_KNOWLEDGE = """
## Part 1 — CI/CD (Spring Boot sync-service, MongoDB, Jenkins, GCP)

### Branching and environment mapping
- Trunk-based variant with long-lived environment branches: `develop` → QA, `release/*` → Staging, `main` → Production.
- `feature/*` and `bugfix/*` are short-lived; they do not auto-deploy to long-lived shared envs; use PRs for review.
- `hotfix/*` can target `main` with additional controls for prod.

### Avoid accidental production deployments
- Branch protection on `main`: required reviews, required status checks, limited merge actors.
- Jenkins `when` / pipeline gates so production stages run only for `main` (or protected tags), never for `develop` or feature branches.
- Separate GCP projects (or at least separate Cloud Run services, Artifact Registry, and Service Accounts) per environment.
- Manual approval (e.g. Jenkins `input` / deployment gate) for production; deploy immutable image digests, not a floating `latest` in prod.
- Production secrets and deploy credentials in dedicated Jenkins credentials / WIF, not the same as QA.

### Jenkins pipeline (high level)
- Checkout → build (Maven/Gradle) → unit tests → static analysis (optional) → build container → push to Google Artifact Registry → deploy to Cloud Run or GCE MIG.
- Stages: Init, Build & Test, Build Docker, Push, Deploy (env-specific), Smoke/health, Notify.

### PR vs merge
- On pull request: build + test; optionally build image for scanning only; do not deploy to production; optional ephemeral/preview for QA.
- On merge to environment branch: run full path including image push and deploy to the mapped environment; production only after merge to `main` plus manual approval.

### Rollback
- If health checks fail after deploy, shift Cloud Run traffic to previous ready revision, or re-deploy the previous good image digest from Artifact Registry. Forward-compatible DB migrations in staging to reduce roll-forward needs.

### Configuration management
- One container image, environment variables per env (or Spring `application-qa.yml` profiles in image with overrides via env).
- Secrets: Google Secret Manager; Cloud Run or JVM reads at runtime. Never commit secrets. Jenkins uses WIF or short-lived SA keys to push to GAR and deploy.

### Deployment strategy
- Cloud Run: rolling revisions with atomic traffic switch; canary/blue-green via traffic split between revisions or two services.
- GKE/VM: rolling update preferred; blue/green for strict cutover; avoid recreate (downtime).
- Minimal downtime: health/readiness checks, pre-warming min instances in prod, connection pool tuning to MongoDB.

## Part 2 — Infrastructure (GCP, auto-scaling, secure, cost-aware)

### Compute
- **Cloud Run** for stateless HTTP Spring Boot: scale to zero in QA, autoscaling, low ops, pay per use — good for startup cost. **GKE (Autopilot)** if org standard is Kubernetes, sidecars, or complex networking. **GCE MIG** if scenario mandates VMs; higher ops. This repo uses Cloud Run with Terraform for cost and speed.

### MongoDB
- **MongoDB Atlas** in same or peered network with IP allowlist or Private Link; connection string in Secret Manager. Self-managed on GCE only if you accept operational burden.

### Networking
- Custom VPC, subnets, Serverless VPC Access connector, optional **Cloud NAT** for stable egress IPs to allowlist in Atlas. HTTPS ingress on Cloud Run by default; restrict with IAM, IAP, or internal LB as needed.

### Secrets & IAM
- Least privilege service account for Cloud Run: Secret Accessor on specific secrets, Artifact Registry read, optional Vertex AI user for the agent. Separate projects per environment where possible.

### Logging & monitoring
- Cloud Logging for stdout/stderr; Cloud Monitoring for metrics, SLOs, and uptime checks; optional Cloud Trace for distributed tracing. Log-based metrics for 5xx/latency.

## Deliverables (GitHub)
- Short design document (Markdown), `Jenkinsfile`, architecture diagram (Mermaid) or image, and written explanation of key choices. Infrastructure as code (e.g. Terraform) is a strong differentiator.
"""
