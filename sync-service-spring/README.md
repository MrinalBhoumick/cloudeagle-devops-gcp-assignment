# `sync-service` (Spring Boot)

Assignment **Spring Boot** + **MongoDB** + **GKE** (see repo root `k8s/` and `terraform/gke*.tf`).

- **Build:** `mvn -B verify` (unit tests; requires JDK 17)
- **Run locally:** set `MONGODB_URI` and `SPRING_PROFILES_ACTIVE` (e.g. `qa`), `mvn spring-boot:run` from this directory, or `docker build -t sync-service:local .` and run the image with the same env vars.

**Endpoints:** `GET /api/v1/info`, `GET /actuator/health`, K8s probes: `/actuator/health/liveness`, `/actuator/health/readiness` (when `management.endpoint.health.probes.enabled=true`).
