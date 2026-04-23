package com.cloudeagle.sync.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.cloudeagle.sync.model.Item;
import com.cloudeagle.sync.service.ItemService;

@WebMvcTest(controllers = ItemController.class)
@Import(ApiExceptionHandler.class)
class ItemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ItemService itemService;

    @Test
    void listReturnsArray() throws Exception {
        when(itemService.findAll())
                .thenReturn(
                        List.of(new Item("a", "T", "D", Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-01-02T00:00:00Z"))));
        mockMvc.perform(get("/api/v1/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("a"))
                .andExpect(jsonPath("$[0].title").value("T"));
    }

    @Test
    void createReturns201() throws Exception {
        var created = new Item("n1", "Hello", "World", Instant.parse("2026-01-15T00:00:00Z"), Instant.parse("2026-01-15T00:00:00Z"));
        when(itemService.create(any())).thenReturn(created);
        mockMvc.perform(
                post("/api/v1/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Hello\",\"description\":\"World\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("n1"));
    }

    @Test
    void get404() throws Exception {
        when(itemService.get("x")).thenThrow(new NoSuchElementException("Item not found: x"));
        mockMvc.perform(get("/api/v1/items/x")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").exists());
    }

    @Test
    void putUpdates() throws Exception {
        var u = new Item("x", "A", "B", Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-01-20T00:00:00Z"));
        when(itemService.update(eq("x"), any())).thenReturn(u);
        mockMvc.perform(
                put("/api/v1/items/x")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"A\",\"description\":\"B\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("A"));
    }

    @Test
    void deleteNoContent() throws Exception {
        mockMvc.perform(delete("/api/v1/items/x")).andExpect(status().isNoContent());
        verify(itemService).delete("x");
    }
}
