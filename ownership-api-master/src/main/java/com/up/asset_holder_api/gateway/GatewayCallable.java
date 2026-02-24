package com.up.asset_holder_api.gateway;

import org.hyperledger.fabric.gateway.Gateway;

/**
 * Callable that runs with a Fabric Gateway and may throw checked exceptions.
 * Used so that runWithWriteLock can propagate ContractException etc. from the lambda.
 */
@FunctionalInterface
public interface GatewayCallable<T> {
    T run(Gateway gateway) throws Exception;
}
