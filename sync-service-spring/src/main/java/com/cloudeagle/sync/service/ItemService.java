package com.cloudeagle.sync.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.cloudeagle.sync.api.dto.ItemRequest;
import com.cloudeagle.sync.model.Item;
import com.cloudeagle.sync.mongo.ItemDocument;
import com.cloudeagle.sync.repository.ItemRepository;

import jakarta.annotation.PostConstruct;

/**
 * When Spring Data Mongo is active ({@code ItemRepository} bean), items are stored in MongoDB. Otherwise
 * (e.g. {@code k8s} profile with Mongo autoconfig excluded) a process-local in-memory store is used.
 */
@Service
public class ItemService {

    private final ItemRepository mongo;
    private final Map<String, Item> byId = new ConcurrentHashMap<>();

    public ItemService(@Autowired(required = false) ItemRepository mongo) {
        this.mongo = mongo;
    }

    @PostConstruct
    void seed() {
        if (mongo == null) {
            Instant t = Instant.parse("2026-01-15T10:00:00Z");
            byId.put(
                    "sample-1",
                    new Item(
                            "sample-1",
                            "Welcome",
                            "In-memory (no Mongo in this profile). For persistent CRUD, set MONGODB_URI and a Mongo-enabled profile (e.g. cloudrun).",
                            t,
                            t));
        } else if (mongo.count() == 0) {
            ItemDocument w = new ItemDocument();
            w.setId("sample-1");
            w.setTitle("Welcome");
            w.setDescription("Persisted in MongoDB. All instances sharing this database see the same data.");
            Instant t = Instant.parse("2026-01-15T10:00:00Z");
            w.setCreatedAt(t);
            w.setUpdatedAt(t);
            mongo.save(w);
        }
    }

    public List<Item> findAll() {
        if (mongo == null) {
            return new ArrayList<>(byId.values()).stream()
                    .sorted((a, b) -> b.updatedAt().compareTo(a.updatedAt()))
                    .toList();
        }
        return mongo.findAllByOrderByUpdatedAtDesc().stream().map(this::toItem).toList();
    }

    public Item get(String id) {
        if (mongo == null) {
            Item item = byId.get(id);
            if (item == null) {
                throw new NoSuchElementException("Item not found: " + id);
            }
            return item;
        }
        return mongo.findById(id)
                .map(this::toItem)
                .orElseThrow(() -> new NoSuchElementException("Item not found: " + id));
    }

    public Item create(ItemRequest request) {
        String id = java.util.UUID.randomUUID().toString();
        Instant now = Instant.now();
        if (mongo == null) {
            Item item = new Item(
                    id,
                    request.getTitle().trim(),
                    request.getDescription() == null ? "" : request.getDescription().trim(),
                    now,
                    now);
            byId.put(id, item);
            return item;
        }
        ItemDocument d = new ItemDocument();
        d.setId(id);
        d.setTitle(request.getTitle().trim());
        d.setDescription(request.getDescription() == null ? "" : request.getDescription().trim());
        d.setCreatedAt(now);
        d.setUpdatedAt(now);
        return toItem(mongo.save(d));
    }

    public Item update(String id, ItemRequest request) {
        if (mongo == null) {
            Item existing = byId.get(id);
            if (existing == null) {
                throw new NoSuchElementException("Item not found: " + id);
            }
            Instant now = Instant.now();
            Item next = new Item(
                    id,
                    request.getTitle().trim(),
                    request.getDescription() == null ? "" : request.getDescription().trim(),
                    existing.createdAt(),
                    now);
            byId.put(id, next);
            return next;
        }
        ItemDocument d = mongo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Item not found: " + id));
        d.setTitle(request.getTitle().trim());
        d.setDescription(request.getDescription() == null ? "" : request.getDescription().trim());
        d.setUpdatedAt(Instant.now());
        return toItem(mongo.save(d));
    }

    public void delete(String id) {
        if (mongo == null) {
            if (byId.remove(id) == null) {
                throw new NoSuchElementException("Item not found: " + id);
            }
        } else {
            if (!mongo.existsById(id)) {
                throw new NoSuchElementException("Item not found: " + id);
            }
            mongo.deleteById(id);
        }
    }

    public boolean isMongo() {
        return mongo != null;
    }

    private Item toItem(ItemDocument d) {
        return new Item(
                d.getId(), d.getTitle(), d.getDescription() == null ? "" : d.getDescription(), d.getCreatedAt(), d.getUpdatedAt());
    }
}
