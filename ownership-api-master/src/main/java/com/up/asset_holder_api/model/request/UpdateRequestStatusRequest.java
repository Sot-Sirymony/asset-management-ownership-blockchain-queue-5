package com.up.asset_holder_api.model.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRequestStatusRequest {
    @NotBlank(message = "Status is required")
    @Pattern(regexp = "ASSIGNED|REJECTED", message = "Status must be ASSIGNED or REJECTED")
    private String status;

    /** Blockchain asset ID when status is ASSIGNED (optional) */
    private String assignedAssetId;
}
