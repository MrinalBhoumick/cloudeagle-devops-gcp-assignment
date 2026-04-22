locals {
  labels = {
    app         = "sync-service"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# --- Network -----------------------------------------------------------------
resource "google_compute_network" "main" {
  name                    = "sync-svc-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "main" {
  name          = "sync-svc-subnet"
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = "10.0.0.0/20"
}

# Serverless connector needs its own /28 in the same region
resource "google_compute_subnetwork" "serverless" {
  name          = "sync-svc-connector-subnet"
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = var.connector_cidr
}

resource "google_vpc_access_connector" "connector" {
  name   = "sync-svc-connector"
  region = var.region
  subnet {
    name = google_compute_subnetwork.serverless.name
  }
  min_instances = 2
  max_instances = 3
  machine_type  = "e2-standard-4"
  depends_on    = [google_project_service.apis, google_compute_subnetwork.serverless]
}

# --- Runtime identity & secrets -----------------------------------------------
resource "google_service_account" "cloudrun" {
  account_id   = "sync-svc-run"
  display_name = "sync-service Cloud Run"
}

resource "google_secret_manager_secret" "mongo_uri" {
  secret_id = "sync-service-mongo-uri"
  labels    = local.labels
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "mongo_uri" {
  secret      = google_secret_manager_secret.mongo_uri.id
  secret_data = var.mongo_connection_string
}

resource "google_secret_manager_secret_iam_member" "cloudrun_mongo" {
  secret_id = google_secret_manager_secret.mongo_uri.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudrun.email}"
}

# --- Artifact Registry -------------------------------------------------------
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "sync-service"
  description   = "sync-service images (Jenkins / Cloud Build push)"
  format        = "DOCKER"
  labels        = local.labels
  depends_on    = [google_project_service.apis]
}

# --- Cloud Run ---------------------------------------------------------------
resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.container_image
      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }
      env {
        name  = "SPRING_PROFILES_ACTIVE"
        value = var.environment
      }
      env {
        name = "MONGODB_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.mongo_uri.id
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.app,
    google_secret_manager_secret.mongo_uri,
    google_secret_manager_secret_version.mongo_uri,
  ]
}

# Public invoke (unauthenticated) — for internal APIs set to false and use IAM + identity.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.create_public_cloud_run ? 1 : 0

  name     = google_cloud_run_v2_service.app.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow Cloud Run to pull from Artifact Registry in same project
resource "google_artifact_registry_repository_iam_member" "run_reader" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.app.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.cloudrun.email}"
}
