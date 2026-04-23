package com.cloudeagle.sync.config;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.util.StringUtils;

/**
 * When no MongoDB URI is configured, exclude Mongo autoconfiguration so the app can start with the
 * in-memory item store. The {@code local} profile may set {@code spring.data.mongodb.uri} in
 * {@code application-local.yml} to use a local mongod without {@code MONGODB_URI} in the
 * environment.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MongoOptionalEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String[] MONGO_EXCLUDES = {
        "org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration",
        "org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration",
        "org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration",
    };

    private static final String EXCLUDE_KEY = "spring.autoconfigure.exclude";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (hasLocalProfile(environment) || isMongoAutoconfigureWanted(environment)) {
            return;
        }
        String existing = environment.getProperty(EXCLUDE_KEY);
        Set<String> merged = new LinkedHashSet<>();
        if (StringUtils.hasText(existing)) {
            for (String part : existing.split(",")) {
                if (StringUtils.hasText(part.trim())) {
                    merged.add(part.trim());
                }
            }
        }
        for (String ex : MONGO_EXCLUDES) {
            merged.add(ex);
        }
        if (merged.isEmpty()) {
            return;
        }
        Map<String, Object> map = new HashMap<>();
        map.put(EXCLUDE_KEY, String.join(",", merged));
        environment.getPropertySources().addFirst(
                new MapPropertySource("sync-mongo-optional-when-no-uri", map));
    }

    private static boolean hasLocalProfile(ConfigurableEnvironment environment) {
        for (String p : environment.getActiveProfiles()) {
            if ("local".equals(p)) {
                return true;
            }
        }
        List<String> fromEnv = parseProfilesFromSource(System.getenv("SPRING_PROFILES_ACTIVE"));
        if (fromEnv.contains("local")) {
            return true;
        }
        return parseProfilesFromSource(environment.getProperty("spring.profiles.active"))
                .contains("local");
    }

    private static List<String> parseProfilesFromSource(String source) {
        List<String> out = new ArrayList<>();
        if (!StringUtils.hasText(source)) {
            return out;
        }
        for (String p : source.split("[,;]")) {
            if (StringUtils.hasText(p.trim())) {
                out.add(p.trim());
            }
        }
        return out;
    }

    /**
     * True when a non-local deployment should use Spring Data Mongo (not in-memory). Empty URIs, or
     * {@code 127.0.0.1}/{@code localhost} (common for broken secrets and Spring defaults) are not
     * usable in Cloud Run / GKE, so we leave Mongo autoconfig off.
     */
    private static boolean isMongoAutoconfigureWanted(ConfigurableEnvironment environment) {
        String m = firstNonBlank(
                System.getenv("MONGODB_URI"),
                System.getProperty("MONGODB_URI"),
                environment.getProperty("spring.data.mongodb.uri"));
        if (!StringUtils.hasText(m)) {
            return false;
        }
        return !isUnusableLocalMongoUri(m);
    }

    private static String firstNonBlank(String a, String b, String c) {
        if (StringUtils.hasText(a)) {
            return a;
        }
        if (StringUtils.hasText(b)) {
            return b;
        }
        return c;
    }

    private static boolean isUnusableLocalMongoUri(String uri) {
        String u = uri.toLowerCase();
        return u.contains("127.0.0.1") || u.contains("localhost");
    }
}
