# CloudEagle DevOps assignment — `sync-service` (GCP, Jenkins, Terraform)

This repository is the **technical assignment** deliverable: **Part 1** (CI/CD design + `Jenkinsfile`) and **Part 2** (infrastructure as code + design notes).

**Public repository (branch `main`):** [github.com/MrinalBhoumick/cloudeagle-devops-gcp-assignment](https://github.com/MrinalBhoumick/cloudeagle-devops-gcp-assignment)

## What’s here

| Item | Path |
|------|------|
| CI/CD design (branching, Jenkins, config, deploy strategy) | [docs/CI_CD_DESIGN.md](docs/CI_CD_DESIGN.md) |
| Jenkins pipeline | [Jenkinsfile](Jenkinsfile) |
| Infra + architecture (Mermaid) | [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) |
| Terraform (VPC, NAT, optional **GKE Autopilot**, GAR, Secret Manager, Cloud Run) | [terraform/](terraform/) |
| **Spring Boot `sync-service`** (assignment scenario: Mongo, profiles qa/staging/prod) | [sync-service-spring/](sync-service-spring/) |
| **Kubernetes (GKE)** — Deployment, Service, HPA, secrets example | [k8s/](k8s/) |
| **Python** sample + **web UI** at `/` + optional Gemini chat | [app/](app/) |
| **Cloud Build** (optional image build) | [cloudbuild.yaml](cloudbuild.yaml) |

### Official brief vs this repo (coverage)

| CloudEagle requirement | Where it is addressed |
|------------------------|------------------------|
| **Part 1 — Branching & env mapping, accidental prod, Jenkins stages, PR vs merge, rollback, env config, secrets, deploy strategy (blue/green etc.)** | [docs/CI_CD_DESIGN.md](docs/CI_CD_DESIGN.md) + [Jenkinsfile](Jenkinsfile) |
| **Part 1 — Deliverable: design doc + Jenkinsfile** | Same files |
| **Part 2 — Compute choice, MongoDB, VPC/ingress, secrets/IAM, logging & monitoring, cost/startup** | [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) + [terraform/](terraform/) |
| **Part 2 — Architecture diagram + written explanation** | Mermaid in `docs/INFRASTRUCTURE.md` |
| **Scenario note (Spring on GCE vs this sample)** | Explained in `docs/CI_CD_DESIGN.md` and `docs/INFRASTRUCTURE.md` — same operational story (build, health, config, deploy) on **Cloud Run** for lower ops cost. |
| **Public access (anyone with the URL)** | Cloud Run is configured for unauthenticated `GET`/`POST` to the service URL (invoker: `allUsers` in Terraform) — see infra doc; treat as a **demo** and restrict IAM for real workloads. |

## Your GCP project (pre-filled for local use)

- **Project ID:** `project-15d206fe-12aa-4854-8f0`  
- **Project number:** `797183135466`  
- **gcloud** should point at the same project: `gcloud config set project project-15d206fe-12aa-4854-8f0`

> **Jenkins / CI:** set `GAR_PROJECT=project-15d206fe-12aa-4854-8f0` to match the Artifact Registry in this project.

## Deploy with Terraform (from your machine)

1. [Install Terraform](https://developer.hashicorp.com/terraform/install) and the [gcloud CLI](https://cloud.google.com/sdk/docs/install).

2. Authenticate and select the project:
   ```powershell
   gcloud auth application-default login
   gcloud config set project project-15d206fe-12aa-4854-8f0
   ```

3. Create `terraform/terraform.tfvars` (not committed) from `terraform/terraform.tfvars.example` and set `project_id`, `container_image`, and `mongo_connection_string`.

4. Your account (or a deploy Service Account) must be able to enable APIs and create resources, for example: **Service Usage Admin**, **Compute Admin**, **Cloud Run Admin**, **Artifact Registry Admin**, **Secret Manager Admin**, **VPC Access User**, and **IAM** as needed, or a broad role such as **Editor** for a one-off assignment project.

5. **Mongo connection string:** do not commit a real production URI. Either:
   - Set `TF_VAR_mongo_connection_string` before apply, or  
   - Put it only in a local, git-ignored `*.secrets.tfvars` and use `terraform apply -var-file=local.secrets.tfvars`.

6. From the `terraform` directory:
   ```powershell
   cd terraform
   terraform init
   terraform plan
   terraform apply
   ```

7. After apply, get the service URL: `terraform output cloud_run_url`

8. When your first **real** image exists in **Artifact Registry**, set `container_image` in your local `terraform.tfvars` to that image tag/digest and run `terraform apply` again.

**If `terraform plan` fails with “No credentials loaded”:** run `gcloud auth application-default login` in the same terminal, then run `terraform plan` again. Terraform uses [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials); `gcloud auth login` alone is not enough for the Google provider unless you also set ADC.
