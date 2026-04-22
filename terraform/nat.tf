# Cloud Router + Cloud NAT: static egress IP(s) for MongoDB Atlas / SaaS allowlists when
# Cloud Run uses the VPC connector with ALL_TRAFFIC egress.
# https://cloud.google.com/nat/docs/overview

resource "google_compute_router" "main" {
  count   = var.enable_cloud_nat ? 1 : 0
  name    = "sync-svc-router"
  region  = var.region
  project = var.project_id
  network = google_compute_network.main.id
  bgp {
    asn = 64514
  }
  depends_on = [google_project_service.apis, google_compute_network.main]
}

resource "google_compute_router_nat" "main" {
  count                              = var.enable_cloud_nat ? 1 : 0
  name                               = "sync-svc-nat"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.main[0].name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  depends_on = [google_compute_router.main]
}
