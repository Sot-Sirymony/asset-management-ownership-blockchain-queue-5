package com.up.asset_holder_api.controller;


import com.fasterxml.jackson.databind.JsonNode;
import com.google.protobuf.Api;
import com.up.asset_holder_api.model.entity.Asset;
import com.up.asset_holder_api.model.request.AssetTrasferRequest;
import com.up.asset_holder_api.model.response.ApiResponse;
import com.up.asset_holder_api.service.AssetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.io.IOException;
import java.sql.Timestamp;

@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "bearerAuth")
@CrossOrigin
@AllArgsConstructor
public class AssetController {

    private final AssetService assetService;

    @GetMapping("/user/getAsset/{id}")
    @Operation(summary = "View asset by id")
    public ResponseEntity<ApiResponse<JsonNode>> getAssetById(@PathVariable("id") String id) throws IOException {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetService.getAssetById(id))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }


    @GetMapping("/user/getAllAsset")
    @Operation(summary = "Get all asset")
    public ResponseEntity<ApiResponse<JsonNode>> getAllAsset() throws IOException {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetService.getAllAsset())
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @GetMapping("/getAllHistory")
    @Operation(summary = "Get all History asset")
    public ResponseEntity<ApiResponse<JsonNode>> getAllHistory() throws IOException {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetService.getAllAssetHistroy())
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @GetMapping("/admin/getHistoryById/{id}")
    @Operation(summary = "Get history asset by id")
    public ResponseEntity<ApiResponse<JsonNode>> getHistoryById(@PathVariable("id") String id) throws IOException {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetService.getHistoryById(id))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @PostMapping("/admin/createAsset")
    @Operation(summary = "Admin create asset (assign asset to user)")
    public ResponseEntity<ApiResponse<JsonNode>> createAsset(@Valid @RequestBody Asset asset) throws IOException {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetService.createAsset(asset))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @PutMapping("/admin/updateAsset/{id}")
    @Operation(summary = "Admin update asset")
    public ResponseEntity<ApiResponse<JsonNode>> updateAsset(@PathVariable String id, @Valid @RequestBody Asset asset) throws IOException {
        ApiResponse<JsonNode> res = ApiResponse.<JsonNode>builder()
                .message("Success")
                .payload(assetService.updateAsset(id,asset))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @PutMapping("/admin/transferAsset/{id}")
    @Operation(summary = "Admin transfer asset")
    public ResponseEntity<ApiResponse<Boolean>> transferAsset(@PathVariable String id,@RequestBody AssetTrasferRequest assetTrasferRequest) throws IOException {
        ApiResponse<Boolean> res = ApiResponse.<Boolean>builder()
                .message("Success")
                .payload(assetService.trasfterAsset(id,assetTrasferRequest))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/user/deleteAsset/{id}")
    @Operation(summary = "User delete asset")
    public ResponseEntity<ApiResponse<Boolean>> deleteAsset(@PathVariable String id) throws IOException {
        ApiResponse<Boolean> res = ApiResponse.<Boolean>builder()
                .message("Success")
                .payload(assetService.deleteAsset(id))
                .timestamp(new Timestamp(System.currentTimeMillis()))
                .httpStatus(HttpStatus.OK)
                .build();
        return ResponseEntity.ok(res);
    }
}
