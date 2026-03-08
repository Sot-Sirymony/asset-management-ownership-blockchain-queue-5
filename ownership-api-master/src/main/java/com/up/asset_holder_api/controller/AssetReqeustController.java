package com.up.asset_holder_api.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.up.asset_holder_api.model.entity.AssetRequest;
import com.up.asset_holder_api.model.request.AssetRequestRes;
import com.up.asset_holder_api.model.request.UpdateRequestStatusRequest;
import com.up.asset_holder_api.model.response.ApiResponse;
import com.up.asset_holder_api.service.AssetRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "bearerAuth")
@CrossOrigin
@AllArgsConstructor
public class AssetReqeustController {

    private final AssetRequestService assetRequestService;

    @GetMapping("/admin/assetRequest")
    @Operation(summary = "Admin get all asset request from user")
    public List<AssetRequest> getAllUserAssetRequest() {
        return assetRequestService.getAllUserAssetRequest();
    }

    @GetMapping("/assetRequest/{id}")
    @Operation(summary = "Admin and user view asset request by id")
    public List<AssetRequest> getUserAssetRequest(@PathVariable Integer id) {
        return assetRequestService.getUserAssetRequestById(id);
    }


    @GetMapping("/user/assetRequest")
    @Operation(summary = "User get all asset reqeust")
    public ResponseEntity<ApiResponse<List<AssetRequest>>> getUserAssetRequest() {
        ApiResponse<List<AssetRequest>> res = ApiResponse.<List<AssetRequest>>builder()
                .message("User get all asset request successful")
                .payload(assetRequestService.getUserAssetRequest())
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }


    @PostMapping("/user/createAssetRequest")
    @Operation(summary = "User create asset request")
    public ResponseEntity<ApiResponse<AssetRequestRes>> createUserAssetRequest(@RequestBody AssetRequestRes requestRes) {
        ApiResponse<AssetRequestRes> res = ApiResponse.<AssetRequestRes>builder()
                .message("Success")
                .payload(assetRequestService.createUserAssetRequest(requestRes))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }


    @PutMapping("/user/updateAssetRequest/{id}")
    @Operation(summary = "User update asset request")
    public ResponseEntity<ApiResponse<AssetRequestRes>> updateUserAssetRequest(@PathVariable Integer id,@RequestBody AssetRequestRes requestRes) {
        ApiResponse<AssetRequestRes> res = ApiResponse.<AssetRequestRes>builder()
                .message("Success")
                .payload(assetRequestService.updateUserAssetRequest(id,requestRes))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }


    @DeleteMapping("/user/deleteAssetRequest/{id}")
    @Operation(summary = "User delete asset request")
    public ResponseEntity<ApiResponse<Boolean>> deleteUserAsset(@PathVariable Integer id) {
        ApiResponse<Boolean> res = ApiResponse.<Boolean>builder()
                .message("Success")
                .payload(assetRequestService.deleteUserAsset(id))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @PutMapping("/admin/assetRequest/{id}/status")
    @Operation(summary = "Admin set request status to ASSIGNED or REJECTED (for tracking)")
    public ResponseEntity<ApiResponse<AssetRequest>> updateRequestStatus(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateRequestStatusRequest request) {
        ApiResponse<AssetRequest> res = ApiResponse.<AssetRequest>builder()
                .message("Success")
                .payload(assetRequestService.updateRequestStatus(id, request))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @PostMapping("/admin/assetRequest/{id}/approveAndCreateAsset")
    @Operation(summary = "Admin approve request: create asset on blockchain (assign to requester) and mark request ASSIGNED")
    public ResponseEntity<ApiResponse<JsonNode>> approveAndCreateAsset(@PathVariable Integer id) {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetRequestService.approveAndCreateAsset(id))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }
}
