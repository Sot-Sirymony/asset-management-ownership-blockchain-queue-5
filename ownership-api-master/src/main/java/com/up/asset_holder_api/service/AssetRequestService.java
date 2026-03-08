package com.up.asset_holder_api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.up.asset_holder_api.model.entity.AssetRequest;
import com.up.asset_holder_api.model.request.AssetRequestRes;
import com.up.asset_holder_api.model.request.UpdateRequestStatusRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public interface AssetRequestService {
    List<AssetRequest> getAllUserAssetRequest();

    List<AssetRequest> getUserAssetRequestById(Integer id);

    List<AssetRequest> getUserAssetRequest();

    AssetRequestRes createUserAssetRequest(AssetRequestRes requestRes);

    AssetRequestRes updateUserAssetRequest(Integer id,AssetRequestRes requestRes);

    Boolean deleteUserAsset(Integer id);

    /**
     * Admin updates request status to ASSIGNED (with optional asset id) or REJECTED.
     */
    AssetRequest updateRequestStatus(Integer requestId, UpdateRequestStatusRequest request);

    /**
     * Admin approves a request by creating the asset on the blockchain (assign to requester) and marking the request as ASSIGNED.
     */
    JsonNode approveAndCreateAsset(Integer requestId);
}
