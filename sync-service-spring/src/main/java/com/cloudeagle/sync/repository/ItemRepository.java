package com.cloudeagle.sync.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.cloudeagle.sync.mongo.ItemDocument;

public interface ItemRepository extends MongoRepository<ItemDocument, String> {

    List<ItemDocument> findAllByOrderByUpdatedAtDesc();
}
