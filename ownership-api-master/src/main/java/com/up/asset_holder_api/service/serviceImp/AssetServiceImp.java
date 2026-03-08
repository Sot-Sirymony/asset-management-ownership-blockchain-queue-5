package com.up.asset_holder_api.service.serviceImp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.up.asset_holder_api.exception.NotFoundException;
import com.up.asset_holder_api.gateway.FabricGatewayCache;
import com.up.asset_holder_api.helper.GatewayHelperV1;
import com.up.asset_holder_api.model.entity.Asset;
import com.up.asset_holder_api.model.entity.User;
import com.up.asset_holder_api.model.request.AssetTrasferRequest;
import com.up.asset_holder_api.model.response.UserRequestResponse;
import com.up.asset_holder_api.repository.UserRepository;
import com.up.asset_holder_api.service.AssetService;
import com.up.asset_holder_api.service.NotificationService;
import com.up.asset_holder_api.util.AssetIdGenerator;
import com.up.asset_holder_api.utils.GetCurrentUser;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hyperledger.fabric.gateway.Contract;
import org.hyperledger.fabric.gateway.ContractException;
import org.hyperledger.fabric.gateway.Gateway;
import org.hyperledger.fabric.gateway.Network;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Service implementation for asset management operations.
 * Handles CRUD operations and interactions with Hyperledger Fabric blockchain.
 */
@Slf4j
@Service
@AllArgsConstructor
public class AssetServiceImp implements AssetService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String CHAINCODE =
            System.getenv().getOrDefault("FABRIC_CHAINCODE", "basic");

    private static final String COUCHDB_BASE_URL =
            System.getenv().getOrDefault("COUCHDB_BASE_URL", "http://couchdb0:5984");

    private static final String COUCHDB_USER =
            System.getenv().getOrDefault("COUCHDB_USER", "admin");

    private static final String COUCHDB_PASS =
            System.getenv().getOrDefault("COUCHDB_PASS", "password");

    /** Identity used for read-only Fabric calls (QueryAllAssets, QueryAsset, GetAssetHistory). Non-admin users typically have no wallet entry; this avoids "user does not exist in wallet" and lets them see assigned assets. */
    private static String fabricReadUser() {
        return System.getenv().getOrDefault("FABRIC_READ_USER", "admin");
    }

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final FabricGatewayCache gatewayCache;

    // ---- Fabric helpers: always use GatewayHelperV1 (channel from env) ----
    private Network fabricNetwork(Gateway gateway) {
        return GatewayHelperV1.getNetwork(gateway);
    }

    private Contract fabricContract(Gateway gateway) {
        return fabricNetwork(gateway).getContract(CHAINCODE);
    }

    private UserRequestResponse currentUserResponse() {
        Integer userId = GetCurrentUser.currentId();
        return userRepository.findUserById(userId);
    }

    /**
     * Retrieves an asset by its ID from the blockchain.
     * Results are cached briefly to reduce Fabric read load.
     */
    @Override
    @Cacheable(cacheNames = "assetById", cacheManager = "blockchainCacheManager",
            key = "'asset_' + T(com.up.asset_holder_api.utils.GetCurrentUser).currentId() + '_' + #id")
    public JsonNode getAssetById(String id) {
        log.debug("Fetching asset with ID: {}", id);

        try {
            Gateway gateway = gatewayCache.getOrCreate(fabricReadUser());
            Contract contract = fabricContract(gateway);
            byte[] result = contract.evaluateTransaction("QueryAsset", id);
            JsonNode asset = MAPPER.readTree(new String(result, StandardCharsets.UTF_8));
            log.info("Successfully retrieved asset: {}", id);
            return asset;
        } catch (ContractException e) {
            log.error("Asset not found: {} - {}", id, e.getMessage());
            throw new NotFoundException("Asset not found: " + id + " (" + e.getMessage() + ")");
        } catch (Exception e) {
            log.error("Failed to get asset by id: {} - {}", id, e.getMessage(), e);
            throw new NotFoundException("Failed to retrieve asset: " + id + ". " + e.getMessage());
        }
    }

    /**
     * Creates a new asset on the blockchain.
     * Generates a unique asset ID using thread-safe UUID generation.
     *
     * @param asset The asset entity to create
     * @return JSON node containing the created asset details
     * @throws NotFoundException if creation fails
     */
    @Override
    @CacheEvict(cacheNames = {"assetById", "allAssetsByUser"}, allEntries = true, cacheManager = "blockchainCacheManager")
    public JsonNode createAsset(Asset asset) {
        log.debug("Creating new asset: {}", asset.getAssetName());
        UserRequestResponse user = currentUserResponse();

        try {
            return gatewayCache.runWithWriteLock(user.getUsername(), gateway -> {
                Contract contract = fabricContract(gateway);
                String assetId = AssetIdGenerator.generateAssetId();
                asset.setAssetId(assetId);
                asset.setUsername(String.valueOf(asset.getAssignTo()));
                log.debug("Generated asset ID: {} for asset: {}", assetId, asset.getAssetName());

                String unit = asset.getUnit() != null ? asset.getUnit() : "";
                String condition = asset.getCondition() != null ? asset.getCondition() : "";
                String attachment = asset.getAttachment() != null ? asset.getAttachment() : "";
                String depName = asset.getDepName() != null ? asset.getDepName() : "default";
                contract.submitTransaction(
                        "CreateAsset",
                        asset.getAssetId(),
                        asset.getAssetName(),
                        unit,
                        condition,
                        attachment,
                        String.valueOf(asset.getAssignTo()),
                        asset.getUsername(),
                        depName,
                        String.valueOf(asset.getQty())
                );

                byte[] result = contract.evaluateTransaction("QueryAsset", asset.getAssetId());
                JsonNode createdAsset = MAPPER.readTree(new String(result, StandardCharsets.UTF_8));

                try {
                    UserRequestResponse assignedUser = userRepository.findUserById(asset.getAssignTo());
                    if (assignedUser != null) {
                        notificationService.sendAssetCreatedNotification(assetId, asset.getAssetName(), assignedUser);
                    }
                } catch (Exception e) {
                    log.warn("Failed to send creation notification, but asset created successfully: {}", e.getMessage());
                }

                log.info("Successfully created asset: {} with ID: {}", asset.getAssetName(), assetId);
                return createdAsset;
            });
        } catch (ContractException e) {
            log.error("Failed to create asset on blockchain: {} - {}", asset.getAssetName(), e.getMessage());
            String msg = "Failed to create asset: " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException(msg);
        } catch (Exception e) {
            log.error("Unexpected error creating asset: {} - {}", asset.getAssetName(), e.getMessage(), e);
            String msg = "Failed to create asset: " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException(msg);
        }
    }

    private static boolean isOrdererOrTransactionError(String message) {
        if (message == null) return false;
        String m = message.toLowerCase();
        return m.contains("orderer") || m.contains("send transaction") || m.contains("transaction");
    }

    /**
     * Updates an existing asset on the blockchain.
     *
     * @param id The asset ID to update
     * @param asset The updated asset data
     * @return JSON node containing the updated asset details
     * @throws NotFoundException if asset is not found or update fails
     */
    @Override
    @CacheEvict(cacheNames = {"assetById", "allAssetsByUser"}, allEntries = true, cacheManager = "blockchainCacheManager")
    public JsonNode updateAsset(String id, Asset asset) {
        log.debug("Updating asset with ID: {}", id);
        UserRequestResponse user = currentUserResponse();

        try {
            return gatewayCache.runWithWriteLock(user.getUsername(), gateway -> {
                Contract contract = fabricContract(gateway);
                asset.setUsername(String.valueOf(asset.getAssignTo()));
                String unit = asset.getUnit() != null ? asset.getUnit() : "";
                String condition = asset.getCondition() != null ? asset.getCondition() : "";
                String attachment = asset.getAttachment() != null ? asset.getAttachment() : "";
                String depName = asset.getDepName() != null ? asset.getDepName() : "default";
                contract.submitTransaction(
                        "UpdateAsset",
                        id,
                        asset.getAssetName(),
                        unit,
                        condition,
                        attachment,
                        String.valueOf(asset.getAssignTo()),
                        asset.getUsername(),
                        depName,
                        String.valueOf(asset.getQty())
                );
                byte[] result = contract.evaluateTransaction("QueryAsset", id);
                JsonNode updatedAsset = MAPPER.readTree(new String(result, StandardCharsets.UTF_8));
                log.info("Successfully updated asset: {}", id);
                return updatedAsset;
            });
        } catch (ContractException e) {
            log.error("Asset not found for update: {} - {}", id, e.getMessage());
            String msg = "Failed to update asset: " + id + ". " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException("Asset not found: " + id + " (" + e.getMessage() + ")");
        } catch (Exception e) {
            log.error("Failed to update asset: {} - {}", id, e.getMessage(), e);
            String msg = "Failed to update asset: " + id + ". " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException(msg);
        }
    }

    /**
     * Deletes an asset from the blockchain.
     *
     * @param id The asset ID to delete
     * @return true if deletion was successful
     * @throws NotFoundException if asset is not found or deletion fails
     */
    @Override
    @CacheEvict(cacheNames = {"assetById", "allAssetsByUser"}, allEntries = true, cacheManager = "blockchainCacheManager")
    public Boolean deleteAsset(String id) {
        log.debug("Deleting asset with ID: {}", id);
        UserRequestResponse user = currentUserResponse();

        try {
            return gatewayCache.runWithWriteLock(user.getUsername(), gateway -> {
                Contract contract = fabricContract(gateway);
                contract.evaluateTransaction("QueryAsset", id);
                contract.submitTransaction("DeleteAsset", id);
                log.info("Successfully deleted asset: {}", id);
                return true;
            });
        } catch (ContractException e) {
            log.error("Asset not found for deletion: {} - {}", id, e.getMessage());
            String msg = "Failed to delete asset: " + id + ". " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException("Asset not found: " + id + " (" + e.getMessage() + ")");
        } catch (Exception e) {
            log.error("Failed to delete asset: {} - {}", id, e.getMessage(), e);
            String msg = "Failed to delete asset: " + id + ". " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException(msg);
        }
    }

    @Override
    @Cacheable(cacheNames = "allAssetsByUser", cacheManager = "blockchainCacheManager",
            key = "'allAssets_' + T(com.up.asset_holder_api.utils.GetCurrentUser).currentId()")
    public JsonNode getAllAsset() {
        try {
            Gateway gateway = gatewayCache.getOrCreate(fabricReadUser());
            Contract contract = fabricContract(gateway);
            ArrayNode assetsWithUserInfo = MAPPER.createArrayNode();
            UserRequestResponse currentUser = userRepository.findUserById(GetCurrentUser.currentId());
            User currentUserEntity = userRepository.findUserByUsername(currentUser.getUsername());
            boolean isAdmin = "ADMIN".equals(currentUserEntity.getRoles());

            byte[] result = contract.evaluateTransaction("QueryAllAssets");
            JsonNode assetNode = MAPPER.readTree(new String(result, StandardCharsets.UTF_8));

            for (JsonNode asset : assetNode) {
                if (!asset.hasNonNull("asset_id") || asset.get("asset_id").asText().isBlank()) continue;
                if (!asset.hasNonNull("assign_to")) continue;

                int userId = Integer.parseInt(asset.get("assign_to").asText());

                if (!isAdmin && userId != currentUser.getUserId()) continue;

                ObjectNode assetWithUserInfo = MAPPER.createObjectNode();
                assetWithUserInfo.put("assetId", asset.path("asset_id").asText(null));
                assetWithUserInfo.put("assetName", asset.path("asset_name").asText(null));
                assetWithUserInfo.put("qty", asset.path("qty").asText(null));
                assetWithUserInfo.put("condition", asset.path("condition").asText(null));
                assetWithUserInfo.put("attachment", asset.path("attachment").asText(null));
                assetWithUserInfo.put("assignDate", asset.path("created_at").asText(null));
                assetWithUserInfo.put("depName", asset.path("dep_name").asText(null));

                UserRequestResponse assignedUser = userRepository.findUserById(userId);
                if (assignedUser != null) {
                    ObjectNode userJson = MAPPER.createObjectNode();
                    userJson.put("userId", String.valueOf(assignedUser.getUserId()));
                    userJson.put("fullName", assignedUser.getFullName() == null ? "" : assignedUser.getFullName());
                    userJson.put("profileImg", assignedUser.getProfileImg() == null ? "" : assignedUser.getProfileImg());
                    userJson.put("department",
                            assignedUser.getDepartment() != null && assignedUser.getDepartment().getDep_name() != null
                                    ? assignedUser.getDepartment().getDep_name()
                                    : "");
                    assetWithUserInfo.set("assignTo", userJson);
                }

                assetsWithUserInfo.add(assetWithUserInfo);
            }

            return assetsWithUserInfo;
        } catch (Exception e) {
            log.error("Failed to get all assets - {}", e.getMessage(), e);
            throw new NotFoundException("Failed to retrieve assets: " + e.getMessage());
        }
    }

    /**
     * Transfers an asset to a new owner.
     * Validates that the current user owns the asset before allowing transfer.
     *
     * @param id The asset ID to transfer
     * @param req The transfer request containing new owner ID
     * @return true if transfer was successful
     * @throws NotFoundException if asset is not found, user doesn't own asset, or transfer fails
     */
    @Override
    @CacheEvict(cacheNames = {"assetById", "allAssetsByUser"}, allEntries = true, cacheManager = "blockchainCacheManager")
    public Boolean trasfterAsset(String id, AssetTrasferRequest req) {
        log.debug("Transferring asset: {} to new owner: {}", id, req.getNewAssignTo());
        UserRequestResponse user = currentUserResponse();

        try {
            return gatewayCache.runWithWriteLock(user.getUsername(), gateway -> {
                Contract contract = fabricContract(gateway);
                byte[] assetBytes = contract.evaluateTransaction("QueryAsset", id);
                JsonNode asset = MAPPER.readTree(new String(assetBytes, StandardCharsets.UTF_8));

                User currentUserEntity = userRepository.findUserByUsername(user.getUsername());
                boolean isAdmin = "ADMIN".equals(currentUserEntity.getRoles());

                if (!isAdmin && asset.has("assign_to")) {
                    int currentOwnerId = Integer.parseInt(asset.get("assign_to").asText());
                    if (currentOwnerId != user.getUserId()) {
                        log.warn("User {} attempted to transfer asset {} owned by user {}",
                                user.getUserId(), id, currentOwnerId);
                        throw new NotFoundException("You do not have permission to transfer this asset. Only the current owner can transfer it.");
                    }
                }

                UserRequestResponse newOwner = userRepository.findUserById(req.getNewAssignTo());
                if (newOwner == null) {
                    log.error("New owner not found: {}", req.getNewAssignTo());
                    throw new NotFoundException("New owner not found: " + req.getNewAssignTo());
                }

                contract.submitTransaction("TransferAsset", id, String.valueOf(req.getNewAssignTo()));

                try {
                    JsonNode assetNode = MAPPER.readTree(new String(assetBytes, StandardCharsets.UTF_8));
                    String assetName = assetNode.has("asset_name") ? assetNode.get("asset_name").asText() : "Unknown Asset";
                    notificationService.sendAssetTransferNotification(id, assetName, user, newOwner);
                } catch (Exception e) {
                    log.warn("Failed to send transfer notification, but transfer succeeded: {}", e.getMessage());
                }

                log.info("Successfully transferred asset: {} from user {} to user {}",
                        id, user.getUserId(), req.getNewAssignTo());
                return true;
            });
        } catch (ContractException e) {
            log.error("Asset not found for transfer: {} - {}", id, e.getMessage());
            String msg = "Failed to transfer asset: " + id + ". " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException("Asset not found: " + id + " (" + e.getMessage() + ")");
        } catch (NotFoundException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to transfer asset: {} - {}", id, e.getMessage(), e);
            String msg = "Failed to transfer asset: " + id + ". " + e.getMessage();
            if (isOrdererOrTransactionError(e.getMessage())) {
                throw new IllegalStateException(msg);
            }
            throw new NotFoundException(msg);
        }
    }

    @Override
    public JsonNode getHistoryById(String id) {
        try {
            Gateway gateway = gatewayCache.getOrCreate(fabricReadUser());
            Contract contract = fabricContract(gateway);
            try {
                contract.evaluateTransaction("QueryAsset", id);
            } catch (ContractException e) {
                log.error("Asset not found for history: {} - {}", id, e.getMessage());
                throw new NotFoundException("Asset not found: " + id + " (" + e.getMessage() + ")");
            }
            byte[] result = contract.evaluateTransaction("GetAssetHistory", id);
            return MAPPER.readTree(new String(result, StandardCharsets.UTF_8));
        } catch (NotFoundException e) {
            throw e;
        } catch (ContractException e) {
            log.error("Asset not found for history: {} - {}", id, e.getMessage());
            throw new NotFoundException("Asset not found: " + id + " (" + e.getMessage() + ")");
        } catch (Exception e) {
            log.error("Failed to get history for asset: {} - {}", id, e.getMessage(), e);
            throw new NotFoundException("Failed to retrieve asset history: " + id + ". " + e.getMessage());
        }
    }

    @Override
    public JsonNode getAllAssetHistroy() {
        String channel = System.getenv().getOrDefault("FABRIC_CHANNEL", "channel-org");
        String couchDbName = channel + "_" + CHAINCODE;
        String url = COUCHDB_BASE_URL + "/" + couchDbName + "/_all_docs?include_docs=true";

        UserRequestResponse userResponse = currentUserResponse();

        try {
            Gateway gateway = gatewayCache.getOrCreate(fabricReadUser());
            User currentUser = userRepository.findUserByUsername(userResponse.getUsername());
            boolean isAdmin = "ADMIN".equals(currentUser.getRoles());

            // ---- 1) Read all docs from CouchDB ----
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");

            String credentials = COUCHDB_USER + ":" + COUCHDB_PASS;
            String basicAuth = "Basic " + Base64.getEncoder()
                    .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
            connection.setRequestProperty("Authorization", basicAuth);

            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                log.error("CouchDB request failed with code: {} for URL: {}", code, url);
                throw new NotFoundException("Failed to retrieve asset history from database: HTTP " + code);
            }

            StringBuilder sb = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
            }

            JsonNode rows = MAPPER.readTree(sb.toString()).path("rows");

            // ---- 2) Query Fabric history using correct channel/chaincode ----
            Contract contract = fabricContract(gateway);
            List<JsonNode> results = new ArrayList<>();

            for (JsonNode row : rows) {
                String id = row.path("id").asText(null);
                if (id == null || id.isBlank()) continue;

                // Skip couchdb system docs like "\u0000...."
                if (id.charAt(0) == '\u0000') continue;

                byte[] resultBytes = contract.evaluateTransaction("GetAssetHistory", id);
                JsonNode history = MAPPER.readTree(new String(resultBytes, StandardCharsets.UTF_8));
                int size = history.size();
                String creationTxId = size > 0 ? history.get(size - 1).path("tx_id").asText(null) : "";

                for (int i = 0; i < size; i++) {
                    JsonNode entry = history.get(i);
                    if (!entry.hasNonNull("asset_id") || entry.get("asset_id").asText().isBlank()) continue;
                    if (!entry.hasNonNull("assign_to")) continue;

                    int assignToUserId = Integer.parseInt(entry.get("assign_to").asText());
                    if (!isAdmin && assignToUserId != currentUser.getUserId()) continue;

                    ObjectNode out = MAPPER.createObjectNode();
                    out.setAll((ObjectNode) entry);
                    out.put("creation_tx_id", creationTxId == null ? "" : creationTxId);
                    out.put("previous_tx_id", i + 1 < size ? history.get(i + 1).path("tx_id").asText(null) : "");

                    UserRequestResponse assignedUser = userRepository.findUserById(assignToUserId);
                    if (assignedUser != null) {
                        ObjectNode userJson = MAPPER.createObjectNode();
                        userJson.put("userId", String.valueOf(assignedUser.getUserId()));
                        userJson.put("fullName", assignedUser.getFullName() == null ? "" : assignedUser.getFullName());
                        userJson.put("profileImg", assignedUser.getProfileImg() == null ? "" : assignedUser.getProfileImg());
                        userJson.put("department",
                                assignedUser.getDepartment() != null && assignedUser.getDepartment().getDep_name() != null
                                        ? assignedUser.getDepartment().getDep_name()
                                        : "");
                        out.set("assignTo", userJson);
                    }

                    results.add(out);
                }
            }

            return MAPPER.valueToTree(results);

        } catch (NotFoundException e) {
            throw e; // Re-throw NotFoundException as-is
        } catch (Exception e) {
            log.error("Failed to get all asset history - {}", e.getMessage(), e);
            throw new NotFoundException("Failed to retrieve asset history: " + e.getMessage());
        }
    }
}
