# Vertex AI (Gemini) for the in-service DevOps agent — same runtime SA as Cloud Run
resource "google_project_iam_member" "cloudrun_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}
