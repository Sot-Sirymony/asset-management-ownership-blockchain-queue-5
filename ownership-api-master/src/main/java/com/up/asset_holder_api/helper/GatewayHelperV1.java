package com.up.asset_holder_api.helper;

import org.hyperledger.fabric.gateway.Gateway;
import org.hyperledger.fabric.gateway.Network;
import org.hyperledger.fabric.gateway.Wallet;
import org.hyperledger.fabric.gateway.Wallets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;

public class GatewayHelperV1 {

    private static final Logger log = LoggerFactory.getLogger(GatewayHelperV1.class);

    private static final String DEFAULT_CHANNEL = "channel-org";
    private static final String DEFAULT_CONN_PROFILE = "/app/connection.yaml";
    /** Use same default as AdminServiceImp so local run (from ownership-api-master) shares one wallet. */
    private static final String DEFAULT_WALLET_DIR = "wallet";

    /** Env var to override /etc/hyperledger/fabric in connection.yaml when API runs on host (e.g. FABRIC_CRYPTO_PATH=$NETWORK_DIR/channel). */
    private static final String ENV_FABRIC_CRYPTO_PATH = "FABRIC_CRYPTO_PATH";
    private static final String DOCKER_CRYPTO_PREFIX = "/etc/hyperledger/fabric";
    /** Path under crypto root that must exist (peer tls cert) to confirm we have the right dir. */
    private static final String PEER_TLS_CERT_RELATIVE = "crypto-config/peerOrganizations/org1.ownify.com/peers/peer0.org1.ownify.com/tls/ca.crt";
    private static final String[] CRYPTO_PATH_RELATIVES = {
        "ownership-network-master/channel",
        "../ownership-network-master/channel",
        "../../ownership-network-master/channel",
    };

    /** Resolve FABRIC_CRYPTO_PATH: use env if set, else try relative paths from user.dir so API works on host without env. */
    private static String resolveCryptoPath() {
        String env = System.getenv().get(ENV_FABRIC_CRYPTO_PATH);
        if (env != null && !env.isBlank()) {
            return Paths.get(env).toAbsolutePath().normalize().toString();
        }
        String cwd = System.getProperty("user.dir");
        if (cwd != null && !cwd.isBlank()) {
            for (String relative : CRYPTO_PATH_RELATIVES) {
                Path candidate = Paths.get(cwd).resolve(relative).resolve(PEER_TLS_CERT_RELATIVE);
                if (Files.exists(candidate) && Files.isRegularFile(candidate)) {
                    String resolved = Paths.get(cwd).resolve(relative).toAbsolutePath().normalize().toString();
                    log.info("Resolved FABRIC_CRYPTO_PATH from cwd: {}", resolved);
                    return resolved;
                }
            }
        }
        return null;
    }

    private static Path resolveNetworkConfigPath() throws Exception {
        // Prefer mounted file (Docker / K8s)
        String profilePath = System.getenv().getOrDefault("CONNECTION_PROFILE", DEFAULT_CONN_PROFILE);
        Path fsPath = Paths.get(profilePath);

        String content;
        if (Files.exists(fsPath) && Files.isRegularFile(fsPath)) {
            content = Files.readString(fsPath, StandardCharsets.UTF_8);
        } else {
            // Fallback local dev: load from classpath
            try (InputStream in = GatewayHelperV1.class.getClassLoader().getResourceAsStream("connection.yaml")) {
                if (in == null) {
                    throw new IllegalStateException(
                            "connection.yaml not found. Mount it at " + profilePath +
                                    " (recommended) or include it in src/main/resources."
                    );
                }
                content = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        }

        // When running on host, connection.yaml has /etc/hyperledger/fabric (Docker path). Replace with local crypto path.
        String cryptoPath = resolveCryptoPath();
        if (cryptoPath != null && !cryptoPath.isBlank()) {
            content = content.replace(DOCKER_CRYPTO_PREFIX, cryptoPath);
        }

        // When on host: use 127.0.0.1 (not localhost) to force IPv4 and avoid TLS/connect issues on Mac.
        // If FABRIC_USE_HOSTS=true, do NOT replace URLs so orderer.ownify.com etc. are used (add them to /etc/hosts → 127.0.0.1).
        boolean useHosts = "true".equalsIgnoreCase(System.getenv().getOrDefault("FABRIC_USE_HOSTS", ""));
        String peerUrl = System.getenv().get("FABRIC_PEER_URL");
        if ((peerUrl == null || peerUrl.isBlank()) && cryptoPath != null && !useHosts) {
            peerUrl = "grpcs://127.0.0.1:7051";
            log.info("FABRIC_PEER_URL not set; using {} for host run", peerUrl);
        }
        if (peerUrl != null && !peerUrl.isBlank()) {
            content = content.replace("grpcs://peer0.org1.ownify.com:7051", peerUrl);
        }
        String ordererUrl = System.getenv().get("FABRIC_ORDERER_URL");
        if ((ordererUrl == null || ordererUrl.isBlank()) && cryptoPath != null && !useHosts) {
            ordererUrl = "grpcs://127.0.0.1:7050";
            log.info("FABRIC_ORDERER_URL not set; using {} for host run", ordererUrl);
        }
        if (ordererUrl != null && !ordererUrl.isBlank()) {
            content = content.replace("grpcs://orderer.ownify.com:7050", ordererUrl);
        }
        if (cryptoPath != null && !useHosts) {
            String orderer2Url = System.getenv().getOrDefault("FABRIC_ORDERER2_URL", "grpcs://127.0.0.1:8050");
            String orderer3Url = System.getenv().getOrDefault("FABRIC_ORDERER3_URL", "grpcs://127.0.0.1:9050");
            content = content.replace("grpcs://orderer2.ownify.com:8050", orderer2Url);
            content = content.replace("grpcs://orderer3.ownify.com:9050", orderer3Url);
        }
        if (useHosts) {
            log.info("FABRIC_USE_HOSTS=true; using connection profile hostnames (ensure /etc/hosts has orderer/peer → 127.0.0.1)");
        }
        if ((ordererUrl == null || ordererUrl.isBlank()) && cryptoPath == null) {
            log.warn("FABRIC_ORDERER_URL is not set. Create/Update/Transfer Asset may fail. Set FABRIC_ORDERER_URL=grpcs://127.0.0.1:7050 when running on host.");
        }

        // Ensure connection profile lists the channel name the app will use (e.g. channel-org).
        String channel = System.getenv().get("FABRIC_CHANNEL");
        if (channel != null && !channel.isBlank() && !DEFAULT_CHANNEL.equals(channel)) {
            content = content.replace("  mychannel:", "  " + channel + ":")
                    .replace("  channel-org:", "  " + channel + ":");
        }

        Path tmp = Files.createTempFile("fabric-connection-", ".yaml");
        tmp.toFile().deleteOnExit();
        Files.writeString(tmp, content, StandardCharsets.UTF_8);
        return tmp;
    }

    private static Wallet loadWallet() throws Exception {
        String walletDir = System.getenv().getOrDefault("WALLET_PATH", DEFAULT_WALLET_DIR);
        Path walletPath = Paths.get(walletDir).toAbsolutePath().normalize();

        if (!Files.exists(walletPath)) {
            try {
                Files.createDirectories(walletPath);
            } catch (Exception e) {
                throw new IllegalStateException("Wallet path does not exist and could not be created: " + walletPath, e);
            }
        }
        return Wallets.newFileSystemWallet(walletPath);
    }

    public static Gateway connect(String username) throws Exception {
        Wallet wallet = loadWallet();

        if (wallet.get(username) == null) {
            String walletDir = System.getenv().getOrDefault("WALLET_PATH", DEFAULT_WALLET_DIR);
            throw new IllegalArgumentException(
                    "User '" + username + "' does not exist in wallet: " + Paths.get(walletDir).toAbsolutePath()
            );
        }

        Path networkConfigPath = resolveNetworkConfigPath();

        boolean discoveryEnabled = Boolean.parseBoolean(
                System.getenv().getOrDefault("FABRIC_DISCOVERY", "false")
        );

        // IMPORTANT: do NOT rely on localhost inside Docker.
        // This setting is handled by your connection.yaml (it must not contain localhost),
        // but we also keep discovery configurable.
        return Gateway.createBuilder()
                .identity(wallet, username)
                .networkConfig(networkConfigPath)
                .discovery(discoveryEnabled)
                .connect();
    }

    /** Always use channel from env so services never hardcode it */
    public static Network getNetwork(Gateway gateway) {
        String channel = System.getenv().getOrDefault("FABRIC_CHANNEL", DEFAULT_CHANNEL);
        return gateway.getNetwork(channel);
    }
}
