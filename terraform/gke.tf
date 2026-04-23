# Optional GKE Autopilot (Spring sync-service) — set enable_gke = true in tfvars.
# Autopilot: Google manages nodes; HPA/ingress via k8s manifests in ../k8s/.

resource "google_container_cluster" "sync_gke" {
  count    = var.enable_gke ? 1 : 0
  name     = var.gke_name
  location = var.region
  project  = var.project_id

  enable_autopilot = true

  release_channel {
    channel = "REGULAR"
  }

  depends_on = [google_project_service.apis]
}

output "gke_name" {
  value       = var.enable_gke ? google_container_cluster.sync_gke[0].name : null
  description = "GKE cluster name when enable_gke is true"
}

output "gke_endpoint" {
  value       = var.enable_gke ? google_container_cluster.sync_gke[0].endpoint : null
  sensitive   = true
  description = "Control plane endpoint (use gcloud get-credentials, not in CI logs)"
}
