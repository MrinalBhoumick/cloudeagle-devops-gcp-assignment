variable "project_id" {
  type        = string
  description = "GCP project ID (use separate projects per env for production)."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Region for Cloud Run, VPC connector, and Artifact Registry."
}

variable "environment" {
  type        = string
  default     = "qa"
  description = "Name tag: qa, staging, or prod."
}

variable "service_name" {
  type        = string
  default     = "sync-service"
  description = "Cloud Run service name (suffix with -qa, -staging, -prod in multi-env)."

}

variable "container_image" {
  type        = string
  description = "Container image in Artifact Registry, e.g. us-central1-docker.pkg.dev/PROJECT/sync-repo/sync-service:tag"
}

variable "cloud_run_min_instances" {
  type        = number
  default     = 0
  description = "0 in QA to save cost; 1+ in prod if cold starts are unacceptable."
}

variable "cloud_run_max_instances" {
  type        = number
  default     = 10
  description = "Cap autoscaling to control cost."
}

variable "cloud_run_cpu" {
  type        = string
  default     = "1"
  description = "CPUs (e.g. 1) for Cloud Run."
}

variable "cloud_run_memory" {
  type        = string
  default     = "1Gi"
  description = "Memory for Cloud Run (1Gi+ recommended when Vertex AI agent is enabled)."
}

variable "connector_cidr" {
  type        = string
  default     = "10.8.0.0/28"
  description = "Dedicated /28 for the Serverless VPC Access connector; must not overlap other subnets."
}

variable "create_public_cloud_run" {
  type        = bool
  default     = true
  description = "If false, restrict Cloud Run to internal ingress (requires GCLB/PSC setup outside this base module)."
}

variable "mongo_connection_string" {
  type        = string
  sensitive   = true
  description = "Full MongoDB connection URI for the app. First version in Secret Manager; replace placeholder before prod."
}

variable "enable_cloud_nat" {
  type        = bool
  default     = true
  description = "Cloud Router + NAT so outbound traffic from Cloud Run (ALL_TRAFFIC via connector) uses Google NAT IPs — use for MongoDB Atlas IP allowlists. Extra cost; set false for minimal spend."
}

variable "enable_uptime_check" {
  type        = bool
  default     = true
  description = "Cloud Monitoring HTTPS uptime check against /actuator/health (requires public Cloud Run URL)."
}

variable "cloud_run_concurrency" {
  type        = number
  default     = 80
  description = "Max concurrent requests per instance (typical 80–160 for APIs)."
}

variable "cloud_run_timeout_seconds" {
  type        = number
  default     = 300
  description = "Request timeout for the service (seconds)."
}

variable "vertex_model" {
  type        = string
  default     = "gemini-1.5-flash"
  description = "Preferred Vertex model id; app also tries built-in fallbacks. Use Model Garden if 404."
}
