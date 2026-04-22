output "project_id" {
  value = var.project_id
}

output "cloud_run_url" {
  value       = google_cloud_run_v2_service.app.uri
  description = "Invoke URL (HTTPS) for the service."
}

output "artifact_registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
  description = "Push Jenkins / Cloud Build images here, then update container_image and redeploy."
}

output "cloud_run_service_account" {
  value       = google_service_account.cloudrun.email
  description = "Runtime SA; needs Secret access (already bound to mongo secret)."
}

output "mongo_secret_id" {
  value       = google_secret_manager_secret.mongo_uri.name
  description = "Secret name in Secret Manager (URI stored; rotate via gcloud/Console)."
}

output "cloud_nat_enabled" {
  value       = var.enable_cloud_nat
  description = "When true, outbound internet from the service uses Cloud NAT (list NAT IPs in Atlas if using ALL_TRAFFIC)."
}

output "nat_gateway_name" {
  value       = var.enable_cloud_nat ? google_compute_router_nat.main[0].name : null
  description = "Cloud NAT resource name (see Cloud Console → VPC network → NAT for external IPs)."
}

output "uptime_check_id" {
  value       = try(google_monitoring_uptime_check_config.https[0].id, null)
  description = "Cloud Monitoring uptime check (if enabled)."
}
