package com.up.asset_holder_api.helper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Resolves the Fabric CA TLS certificate (pem) file path so it works on both
 * Unix and Windows when the default path (e.g. /etc/hyperledger/fabric/...)
 * does not exist (e.g. when API runs on host instead of Docker).
 * Tries: configured path, FABRIC_CRYPTO_PATH + relative, then common relative paths from cwd.
 */
public final class FabricCaPemResolver {

    private static final String ENV_FABRIC_CRYPTO_PATH = "FABRIC_CRYPTO_PATH";
    private static final String CA_CERT_RELATIVE = "crypto-config/peerOrganizations/org1.ownify.com/users/Admin@org1.ownify.com/tls/ca.crt";
    /** Relative paths from cwd to channel dir (repo root vs ownership-api-master). */
    private static final String[] CRYPTO_PATH_RELATIVES = {
        "ownership-network-master/channel",
        "../ownership-network-master/channel",
        "../../ownership-network-master/channel",
    };

    private FabricCaPemResolver() {
    }

    /**
     * Returns a path to the CA pem file that exists on the filesystem when possible.
     * Tries: configured path, FABRIC_CRYPTO_PATH + relative, then CRYPTO_PATH_RELATIVES from current working directory.
     */
    public static String resolvePemFilePath(String configuredPemFile) {
        if (configuredPemFile == null || configuredPemFile.isBlank()) {
            return configuredPemFile;
        }
        Path configured = Paths.get(configuredPemFile);
        if (Files.exists(configured) && Files.isRegularFile(configured)) {
            return configuredPemFile;
        }
        String cryptoPath = System.getenv().get(ENV_FABRIC_CRYPTO_PATH);
        if (cryptoPath != null && !cryptoPath.isBlank()) {
            Path fallback = Paths.get(cryptoPath, CA_CERT_RELATIVE.split("/"));
            if (Files.exists(fallback) && Files.isRegularFile(fallback)) {
                return fallback.toAbsolutePath().normalize().toString();
            }
        }
        String cwd = System.getProperty("user.dir");
        if (cwd != null && !cwd.isBlank()) {
            for (String relative : CRYPTO_PATH_RELATIVES) {
                Path candidate = Paths.get(cwd).resolve(relative).resolve(CA_CERT_RELATIVE);
                if (Files.exists(candidate) && Files.isRegularFile(candidate)) {
                    return candidate.toAbsolutePath().normalize().toString();
                }
            }
        }
        return configuredPemFile;
    }
}
