package com.cloudeagle.sync.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ItemRequest {

    @NotBlank(message = "title is required")
    @Size(max = 200, message = "title too long")
    private String title;

    @Size(max = 2000, message = "description too long")
    private String description = "";

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
