# CloudEagle DevOps assignment — `sync-service` (GCP, Jenkins, Terraform)

This repository is the **technical assignment** deliverable: **Part 1** (CI/CD design + `Jenkinsfile`) and **Part 2** (infrastructure as code + design notes).

## What’s here

| Item | Path |
|------|------|
| CI/CD design (branching, Jenkins, config, deploy strategy) | [docs/CI_CD_DESIGN.md](docs/CI_CD_DESIGN.md) |
| Jenkins pipeline | [Jenkinsfile](Jenkinsfile) |
| Infra + architecture (Mermaid) | [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) |
| Terraform (VPC, connector, GAR, Secret Manager, Cloud Run) | [terraform/](terraform/) |

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

