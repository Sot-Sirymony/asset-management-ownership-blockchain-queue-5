package com.up.asset_holder_api.service.serviceImp;

import com.fasterxml.jackson.databind.JsonNode;
import com.up.asset_holder_api.exception.NotFoundException;
import com.up.asset_holder_api.model.entity.Asset;
import com.up.asset_holder_api.model.entity.AssetRequest;
import com.up.asset_holder_api.model.entity.User;
import com.up.asset_holder_api.model.request.AssetRequestRes;
import com.up.asset_holder_api.model.request.UpdateRequestStatusRequest;
import com.up.asset_holder_api.model.response.UserRequestResponse;
import com.up.asset_holder_api.repository.AssetRequestRepository;
import com.up.asset_holder_api.repository.UserRepository;
import com.up.asset_holder_api.service.AssetRequestService;
import com.up.asset_holder_api.service.AssetService;
import com.up.asset_holder_api.utils.GetCurrentUser;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service implementation for asset request management operations.
 */
@Slf4j
@Service
@AllArgsConstructor
public class AssetRequestServiceImp implements AssetRequestService {

    private final AssetRequestRepository assetRequestRepository;
    private final UserRepository userRepository;
    private final AssetService assetService;

    @Override
    public List<AssetRequest> getAllUserAssetRequest() {
        log.debug("Fetching all user asset requests");
        return assetRequestRepository.findAllUserAssetRequest();
    }

    /**
     * Retrieves asset request by ID.
     * Admins can view any request, users can only view their own requests.
     *
     * @param id The asset request ID
     * @return List of asset requests
     * @throws NotFoundException if request is not found
     */
    @Override
    public List<AssetRequest> getUserAssetRequestById(Integer id) {
        Integer userId = GetCurrentUser.currentId();
        log.debug("Fetching asset request: {} for user: {}", id, userId);
        
        User user = userRepository.findUserId(userId);
        if (user == null) {
            log.error("User not found: {}", userId);
            throw new NotFoundException("User not found");
        }
        
        if (user.getRoles().equals("ADMIN")){
            List<AssetRequest> requests = assetRequestRepository.findUserAssetRequestById(id);
            if (requests.isEmpty()){
                log.warn("Asset request not found: {}", id);
                throw new NotFoundException("The asset request is not found");
            }
            log.debug("Admin retrieved asset request: {}", id);
            return requests;
        }else{
            List<AssetRequest> requests = assetRequestRepository.findUserOwnAssetRequestById(id, userId);
            if (requests.isEmpty()) {
                log.warn("Asset request not found for user: {} - request ID: {}", userId, id);
                throw new NotFoundException("The asset request is not found");
            }
            log.debug("User {} retrieved own asset request: {}", userId, id);
            return requests;
        }
    }

    @Override
    public List<AssetRequest> getUserAssetRequest() {
        Integer userId = GetCurrentUser.currentId();
        return assetRequestRepository.findUserAssetRequest(userId);
    }

    @Override
    public AssetRequestRes createUserAssetRequest(AssetRequestRes requestRes) {
        Integer userId = GetCurrentUser.currentId();
        return assetRequestRepository.insertUserAssetRequest(requestRes,userId);
    }

    @Override
    public AssetRequestRes updateUserAssetRequest(Integer requestId,AssetRequestRes requestRes) {
        return assetRequestRepository.updateUserAssetRequest(requestRes,requestId);
    }

    @Override
    public Boolean deleteUserAsset(Integer id) {
        Integer userId = GetCurrentUser.currentId();
        return assetRequestRepository.deleteUserAsset(id, userId);
    }

    @Override
    public AssetRequest updateRequestStatus(Integer requestId, UpdateRequestStatusRequest request) {
        List<AssetRequest> existing = assetRequestRepository.findUserAssetRequestById(requestId);
        if (existing == null || existing.isEmpty()) {
            throw new NotFoundException("Asset request not found: " + requestId);
        }
        String assignedAssetId = "ASSIGNED".equals(request.getStatus()) ? request.getAssignedAssetId() : null;
        int updated = assetRequestRepository.updateRequestStatus(requestId, request.getStatus(), assignedAssetId);
        if (updated == 0) {
            throw new NotFoundException("Asset request not found or update failed: " + requestId);
        }
        List<AssetRequest> updatedList = assetRequestRepository.findUserAssetRequestById(requestId);
        return updatedList.isEmpty() ? existing.get(0) : updatedList.get(0);
    }

    @Override
    public JsonNode approveAndCreateAsset(Integer requestId) {
        List<AssetRequest> list = assetRequestRepository.findUserAssetRequestById(requestId);
        if (list == null || list.isEmpty()) {
            throw new NotFoundException("Asset request not found: " + requestId);
        }
        AssetRequest request = list.get(0);
        if (request.getUser() == null || request.getUser().getUserId() == null) {
            throw new NotFoundException("Request has no user to assign the asset to");
        }
        String status = request.getStatus();
        if (status != null && !"PENDING".equalsIgnoreCase(status)) {
            throw new IllegalStateException("Request is already " + status + ". Only PENDING requests can be approved.");
        }

        UserRequestResponse requester = request.getUser();
        Asset asset = Asset.builder()
                .assetName(request.getAssetName() != null ? request.getAssetName() : "Asset")
                .qty(request.getQty() != null ? String.valueOf(request.getQty()) : "1")
                .unit(request.getUnit() != null ? String.valueOf(request.getUnit()) : "")
                .condition("New")
                .attachment(request.getAttachment() != null ? request.getAttachment() : "")
                .assignTo(requester.getUserId())
                .build();

        JsonNode createdAsset = assetService.createAsset(asset);
        String assetId = createdAsset.has("asset_id") ? createdAsset.get("asset_id").asText() : null;
        if (assetId != null) {
            assetRequestRepository.updateRequestStatus(requestId, "ASSIGNED", assetId);
            log.info("Request {} approved: created asset {} on blockchain and assigned to user {}", requestId, assetId, requester.getUserId());
        }
        return createdAsset;
    }
}
