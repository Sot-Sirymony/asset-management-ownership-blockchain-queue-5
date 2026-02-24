package com.up.asset_holder_api.configuration;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.concurrent.TimeUnit;

/**
 * Cache configuration for frequently accessed data.
 * Implements caching for users, departments, and other frequently queried entities.
 * Includes a short-TTL cache manager for blockchain read results.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    private static final int BLOCKCHAIN_CACHE_TTL_SECONDS = 30;
    private static final int BLOCKCHAIN_CACHE_MAX_SIZE = 500;

    /**
     * Default cache manager for non-blockchain data (departments, users, assets).
     */
    @Bean
    @Primary
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(
                "users", "departments", "assets"
        );
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(10, TimeUnit.MINUTES)
                .maximumSize(1000)
                .recordStats()
        );
        return cacheManager;
    }

    /**
     * Short-TTL cache manager for blockchain read results (e.g. QueryAsset, QueryAllAssets).
     * Evicted on writes so reads stay fresh within the TTL window.
     */
    @Bean("blockchainCacheManager")
    public CacheManager blockchainCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(
                "assetById", "allAssetsByUser", "allIssuesByUser", "issueById", "dashboardCounts"
        );
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(BLOCKCHAIN_CACHE_TTL_SECONDS, TimeUnit.SECONDS)
                .maximumSize(BLOCKCHAIN_CACHE_MAX_SIZE)
                .recordStats()
        );
        return cacheManager;
    }
}
