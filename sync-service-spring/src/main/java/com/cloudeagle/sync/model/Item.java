package com.cloudeagle.sync.model;

import java.time.Instant;

/**
 * In-memory item for demo CRUD. Replace with Mongo/Postgres in production.
 */
public record Item(String id, String title, String description, Instant createdAt, Instant updatedAt) {
}
