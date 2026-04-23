package com.cloudeagle.sync.api.dto;

import java.time.Instant;

import com.cloudeagle.sync.model.Item;

public record ItemResponse(String id, String title, String description, Instant createdAt, Instant updatedAt) {

    public static ItemResponse from(Item item) {
        return new ItemResponse(item.id(), item.title(), item.description(), item.createdAt(), item.updatedAt());
    }
}
