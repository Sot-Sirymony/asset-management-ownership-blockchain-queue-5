package com.up.asset_holder_api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.up.asset_holder_api.configuration.BeanConfig;
import com.up.asset_holder_api.configuration.SecurityConfig;
import com.up.asset_holder_api.jwt.JwtAuthEntrypoint;
import com.up.asset_holder_api.jwt.JwtAuthFilter;
import com.up.asset_holder_api.jwt.JwtUtil;
import com.up.asset_holder_api.model.entity.Asset;
import com.up.asset_holder_api.model.request.AssetTrasferRequest;
import com.up.asset_holder_api.service.AppUserService;
import com.up.asset_holder_api.service.AssetService;
import com.up.asset_holder_api.testsupport.SecurityTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for Asset API (blockchain-backed: QueryAsset, QueryAllAssets, CreateAsset, UpdateAsset, DeleteAsset, TransferAsset, GetAssetHistory).
 */
@WebMvcTest(controllers = AssetController.class)
@Import({SecurityConfig.class, BeanConfig.class, JwtAuthFilter.class, JwtAuthEntrypoint.class})
class AssetControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AssetService assetService;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private AppUserService appUserService;

    @BeforeEach
    void setupJwtAsUser() {
        SecurityTestSupport.mockJwtAsUser(jwtUtil, appUserService);
    }

    @Test
    void getAssetById_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/user/getAsset/{id}", "asset-1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getAssetById_asUser_returnsOk() throws Exception {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("asset_id", "asset-1");
        payload.put("asset_name", "Test Laptop");
        when(assetService.getAssetById(eq("asset-1"))).thenReturn(payload);

        mockMvc.perform(get("/api/v1/user/getAsset/{id}", "asset-1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.payload.asset_id").value("asset-1"))
                .andExpect(jsonPath("$.payload.asset_name").value("Test Laptop"));
    }

    @Test
    void getAllAssets_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/user/getAllAsset"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getAllAssets_asUser_returnsOk() throws Exception {
        // AssetService#getAllAsset returns JsonNode in this project
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.putArray("items");
        when(assetService.getAllAsset()).thenReturn(payload);

        mockMvc.perform(get("/api/v1/user/getAllAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.payload.items").isArray());
    }

    @Test
    void getAllHistory_asUser_returnsOk() throws Exception {
        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.putArray("history");
        when(assetService.getAllAssetHistroy()).thenReturn(payload);

        mockMvc.perform(get("/api/v1/getAllHistory")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload.history").isArray());
    }

    @Test
    void transferAsset_requiresAuth() throws Exception {
        AssetTrasferRequest req = AssetTrasferRequest.builder().newAssignTo(2).build();
        mockMvc.perform(put("/api/v1/admin/transferAsset/{id}", "asset1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void transferAsset_requiresAdmin() throws Exception {
        AssetTrasferRequest req = AssetTrasferRequest.builder().newAssignTo(2).build();

        // User token should be forbidden for /api/v1/admin/**
        mockMvc.perform(put("/api/v1/admin/transferAsset/{id}", "asset1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    void transferAsset_asAdmin_returnsOk() throws Exception {
        // Switch mocked JWT to ADMIN for this test
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);

        when(assetService.trasfterAsset(eq("asset1"), any(AssetTrasferRequest.class))).thenReturn(true);

        AssetTrasferRequest req = AssetTrasferRequest.builder().newAssignTo(2).build();

        mockMvc.perform(put("/api/v1/admin/transferAsset/{id}", "asset1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload").value(true));
    }

    @Test
    void getHistoryById_asAdmin_returnsOk() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);

        ObjectNode payload = JsonNodeFactory.instance.objectNode();
        payload.put("assetId", "asset1");
        when(assetService.getHistoryById(eq("asset1"))).thenReturn(payload);

        mockMvc.perform(get("/api/v1/admin/getHistoryById/{id}", "asset1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload.assetId").value("asset1"));
    }

    @Test
    void createAsset_requiresAdmin() throws Exception {
        Asset asset = Asset.builder().assetName("Laptop").qty("1").assignTo(1).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Assign asset as admin - 200 OK")
    void createAsset_asAdmin_returnsOk() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
        ObjectNode created = JsonNodeFactory.instance.objectNode();
        created.put("asset_id", "asset-new");
        created.put("asset_name", "New Laptop");
        when(assetService.createAsset(any(Asset.class))).thenReturn(created);

        Asset asset = Asset.builder().assetName("New Laptop").qty("1").assignTo(1).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload.asset_id").value("asset-new"))
                .andExpect(jsonPath("$.payload.asset_name").value("New Laptop"));
    }

    // --- Assign asset (createAsset) test cases ---

    @Test
    @DisplayName("Assign asset without auth - 401")
    void createAsset_unauthorized_returns401() throws Exception {
        Asset asset = Asset.builder().assetName("Laptop").qty("1").assignTo(1).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Assign asset without assignTo - 400")
    void createAsset_withoutAssignTo_returnsBadRequest() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
        Asset asset = Asset.builder().assetName("Laptop").qty("1").build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Assign asset with assignTo zero - 400")
    void createAsset_withAssignToZero_returnsBadRequest() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
        Asset asset = Asset.builder().assetName("Laptop").qty("1").assignTo(0).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Assign asset with blank assetName - 400")
    void createAsset_withBlankAssetName_returnsBadRequest() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
        Asset asset = Asset.builder().assetName("").qty("1").assignTo(1).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Assign asset with blank qty - 400")
    void createAsset_withBlankQty_returnsBadRequest() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
        Asset asset = Asset.builder().assetName("Laptop").qty("").assignTo(1).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Assign asset as non-admin - 403")
    void createAsset_asNonAdmin_returnsForbidden() throws Exception {
        Asset asset = Asset.builder().assetName("Laptop").qty("1").assignTo(1).build();
        mockMvc.perform(post("/api/v1/admin/createAsset")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateAsset_asAdmin_returnsOk() throws Exception {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
        ObjectNode updated = JsonNodeFactory.instance.objectNode();
        updated.put("asset_id", "asset-1");
        updated.put("asset_name", "Updated Laptop");
        when(assetService.updateAsset(eq("asset-1"), any(Asset.class))).thenReturn(updated);

        Asset asset = Asset.builder().assetName("Updated Laptop").qty("2").assignTo(1).build();
        mockMvc.perform(put("/api/v1/admin/updateAsset/{id}", "asset-1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(asset)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload.asset_name").value("Updated Laptop"));
    }

    @Test
    void deleteAsset_requiresAuth() throws Exception {
        mockMvc.perform(delete("/api/v1/user/deleteAsset/{id}", "asset-1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteAsset_asUser_returnsOk() throws Exception {
        when(assetService.deleteAsset(eq("asset-1"))).thenReturn(true);

        mockMvc.perform(delete("/api/v1/user/deleteAsset/{id}", "asset-1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload").value(true));
    }
}
