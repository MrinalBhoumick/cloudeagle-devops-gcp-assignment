package com.cloudeagle.sync.api;

import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cloudeagle.sync.repository.ItemRepository;

@RestController
public class InfoController {
    private final Environment env;
    private final ObjectProvider<ItemRepository> itemRepository;

    @Value("${sync.service.name:sync-service}")
    private String serviceName;

    public InfoController(Environment env, ObjectProvider<ItemRepository> itemRepository) {
        this.env = env;
        this.itemRepository = itemRepository;
    }

    @GetMapping("/api/v1/info")
    public Map<String, Object> info() {
        String itemStorage = itemRepository.getIfAvailable() != null ? "mongodb" : "in-memory";
        return Map.of(
            "service", serviceName,
            "version", env.getProperty("sync.service.version", "1.0.0-SNAPSHOT"),
            "activeProfiles", env.getActiveProfiles(),
            "items", Map.of("storage", itemStorage)
        );
    }
}
