package com.up.asset_holder_api.model.entity;

import com.up.asset_holder_api.model.response.UserRequestResponse;
import com.up.asset_holder_api.model.response.UserResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
public class AssetRequest {
    private Integer requestId;
    private UserRequestResponse user;
    private String assetName;
    private Integer qty;
    private Integer unit;
    private String reason;
    private String attachment;
    private LocalDateTime createdAt;
    /** PENDING, ASSIGNED, REJECTED */
    private String status;
    /** Blockchain asset ID when request is fulfilled */
    private String assignedAssetId;
    private LocalDateTime resolvedAt;
}
