package com.up.asset_holder_api.gateway;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import com.github.benmanes.caffeine.cache.RemovalCause;
import com.up.asset_holder_api.helper.GatewayHelperV1;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.hyperledger.fabric.gateway.Gateway;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Per-user Fabric Gateway cache to avoid opening/closing a Gateway on every request.
 * Uses Caffeine with bounded size and idle TTL. Write operations are serialized per user
 * via a per-username lock to reduce thread-safety risk with submitTransaction.
 */
@Slf4j
@Component
public class FabricGatewayCache {

    private static final int DEFAULT_MAX_SIZE = 200;
    private static final int DEFAULT_IDLE_MINUTES = 10;

    private final LoadingCache<String, Gateway> cache;
    private final ConcurrentHashMap<String, ReentrantLock> writeLocks = new ConcurrentHashMap<>();

    public FabricGatewayCache() {
        int maxSize = Integer.parseInt(
                System.getenv().getOrDefault("FABRIC_GATEWAY_CACHE_MAX_SIZE", String.valueOf(DEFAULT_MAX_SIZE)));
        int idleMinutes = Integer.parseInt(
                System.getenv().getOrDefault("FABRIC_GATEWAY_CACHE_IDLE_MINUTES", String.valueOf(DEFAULT_IDLE_MINUTES)));

        this.cache = Caffeine.newBuilder()
                .maximumSize(maxSize)
                .expireAfterAccess(idleMinutes, TimeUnit.MINUTES)
                .removalListener((String key, Gateway gateway, RemovalCause cause) -> {
                    if (gateway != null) {
                        try {
                            gateway.close();
                            log.debug("Closed Fabric Gateway for user: {} (cause: {})", key, cause);
                        } catch (Exception e) {
                            log.warn("Error closing Gateway for user {}: {}", key, e.getMessage());
                        }
                    }
                    writeLocks.remove(key);
                })
                .build(this::connect);

        log.info("FabricGatewayCache initialized: maxSize={}, idleMinutes={}", maxSize, idleMinutes);
    }

    private Gateway connect(String username) throws Exception {
        return GatewayHelperV1.connect(username);
    }

    /**
     * Returns a Gateway for the given user, creating one if necessary. Reuse for read-only
     * (evaluateTransaction) operations. Do not close the returned Gateway.
     */
    public Gateway getOrCreate(String username) {
        try {
            return cache.get(username);
        } catch (Exception e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            log.error("Failed to get or create Gateway for user {}: {}", username, cause.getMessage());
            throw new RuntimeException("Failed to connect to Fabric: " + cause.getMessage(), cause);
        }
    }

    /**
     * Runs a write operation (e.g. submitTransaction) with a per-user lock so that
     * concurrent writes for the same user are serialized on one Gateway.
     * The callable may throw checked exceptions (e.g. ContractException).
     */
    public <T> T runWithWriteLock(String username, GatewayCallable<T> action) throws Exception {
        ReentrantLock lock = writeLocks.computeIfAbsent(username, k -> new ReentrantLock());
        lock.lock();
        try {
            Gateway gateway = getOrCreate(username);
            return action.run(gateway);
        } finally {
            lock.unlock();
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down FabricGatewayCache, invalidating all entries");
        cache.invalidateAll();
        writeLocks.clear();
    }
}
