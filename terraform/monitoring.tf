# Synthetic HTTPS check against the public Cloud Run URL (global, multi-region).
# https://cloud.google.com/monitoring/uptime-checks

resource "google_monitoring_uptime_check_config" "https" {
  count        = var.enable_uptime_check && var.create_public_cloud_run ? 1 : 0
  display_name = "${var.service_name} /actuator/health (HTTPS)"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path           = "/actuator/health"
    use_ssl        = true
    port           = 443
    request_method = "GET"
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  selected_regions = [
    "USA",
    "EUROPE",
    "ASIAPAC",
  ]

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimsuffix(replace(google_cloud_run_v2_service.app.uri, "https://", ""), "/")
    }
  }

  user_labels = local.labels
}
