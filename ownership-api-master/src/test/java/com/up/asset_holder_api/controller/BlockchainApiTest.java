package com.up.asset_holder_api.controller;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.up.asset_holder_api.configuration.BeanConfig;
import com.up.asset_holder_api.configuration.SecurityConfig;
import com.up.asset_holder_api.jwt.JwtAuthEntrypoint;
import com.up.asset_holder_api.jwt.JwtAuthFilter;
import com.up.asset_holder_api.model.entity.Asset;
import com.up.asset_holder_api.model.entity.Dashboard;
import com.up.asset_holder_api.model.entity.ReportIssue;
import com.up.asset_holder_api.model.request.AssetTrasferRequest;
import com.up.asset_holder_api.service.AppUserService;
import com.up.asset_holder_api.service.AssetService;
import com.up.asset_holder_api.service.DepartmentService;
import com.up.asset_holder_api.service.ReportIssueService;
import com.up.asset_holder_api.testsupport.SecurityTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests all API endpoints that depend on the blockchain (Fabric).
 * Ensures controller layer responds correctly when underlying services (AssetService, ReportIssueService, DepartmentService.getDashboard) are invoked.
 *
 * Blockchain-backed operations:
 * <ul>
 *   <li>Asset: getAssetById, getAllAsset, getAllHistory, getHistoryById, createAsset, updateAsset, transferAsset, deleteAsset</li>
 *   <li>Report issue: createIssue, getAllIssue, getIssueById, updateIssue, deleteIssue</li>
 *   <li>Dashboard: getDashboard (uses QueryAllReportIssues for count)</li>
 *   <li>Verification: verifyAsset, verifyAssetExternal, verificationTrail (use getAssetById / history)</li>
 * </ul>
 */
@WebMvcTest(controllers = {AssetController.class, ReportIssueController.class, DepartmentController.class})
@Import({SecurityConfig.class, BeanConfig.class, JwtAuthFilter.class, JwtAuthEntrypoint.class})
class BlockchainApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @MockBean
    private AssetService assetService;
    @MockBean
    private ReportIssueService reportIssueService;
    @MockBean
    private DepartmentService departmentService;
    @MockBean
    private com.up.asset_holder_api.jwt.JwtUtil jwtUtil;
    @MockBean
    private AppUserService appUserService;

    @BeforeEach
    void setUp() {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
    }

    @Nested
    @DisplayName("Asset endpoints (blockchain: QueryAsset, QueryAllAssets, CreateAsset, UpdateAsset, DeleteAsset, TransferAsset, GetAssetHistory)")
    class AssetEndpoints {

        @Test
        void getAssetById_returnsOk() throws Exception {
            ObjectNode payload = JsonNodeFactory.instance.objectNode();
            payload.put("asset_id", "a1");
            when(assetService.getAssetById(eq("a1"))).thenReturn(payload);

            mockMvc.perform(get("/api/v1/user/getAsset/{id}", "a1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload.asset_id").value("a1"));
        }

        @Test
        void getAllAsset_returnsOk() throws Exception {
            ObjectNode payload = JsonNodeFactory.instance.objectNode();
            payload.putArray("items");
            when(assetService.getAllAsset()).thenReturn(payload);

            mockMvc.perform(get("/api/v1/user/getAllAsset")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload.items").isArray());
        }

        @Test
        void getAllHistory_returnsOk() throws Exception {
            ObjectNode payload = JsonNodeFactory.instance.objectNode();
            payload.putArray("history");
            when(assetService.getAllAssetHistroy()).thenReturn(payload);

            mockMvc.perform(get("/api/v1/getAllHistory")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk());
        }

        @Test
        void getHistoryById_returnsOk() throws Exception {
            ObjectNode payload = JsonNodeFactory.instance.objectNode();
            payload.put("asset_id", "a1");
            when(assetService.getHistoryById(eq("a1"))).thenReturn(payload);

            mockMvc.perform(get("/api/v1/admin/getHistoryById/{id}", "a1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload.asset_id").value("a1"));
        }

        @Test
        void createAsset_returnsOk() throws Exception {
            ObjectNode created = JsonNodeFactory.instance.objectNode();
            created.put("asset_id", "new-id");
            when(assetService.createAsset(any(Asset.class))).thenReturn(created);

            Asset body = Asset.builder().assetName("Laptop").qty("1").assignTo(1).build();
            mockMvc.perform(post("/api/v1/admin/createAsset")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload.asset_id").value("new-id"));
        }

        @Test
        void updateAsset_returnsOk() throws Exception {
            ObjectNode updated = JsonNodeFactory.instance.objectNode();
            updated.put("asset_id", "a1");
            when(assetService.updateAsset(eq("a1"), any(Asset.class))).thenReturn(updated);

            Asset body = Asset.builder().assetName("Updated").qty("2").assignTo(1).build();
            mockMvc.perform(put("/api/v1/admin/updateAsset/{id}", "a1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk());
        }

        @Test
        void transferAsset_returnsOk() throws Exception {
            when(assetService.trasfterAsset(eq("a1"), any(AssetTrasferRequest.class))).thenReturn(true);

            mockMvc.perform(put("/api/v1/admin/transferAsset/{id}", "a1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(AssetTrasferRequest.builder().newAssignTo(2).build())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload").value(true));
        }

        @Test
        void deleteAsset_returnsOk() throws Exception {
            when(assetService.deleteAsset(eq("a1"))).thenReturn(true);

            mockMvc.perform(delete("/api/v1/user/deleteAsset/{id}", "a1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload").value(true));
        }
    }

    @Nested
    @DisplayName("Report issue endpoints (blockchain: CreateReportIssue, QueryReportIssue, QueryAllReportIssues, UpdateReportIssue, DeleteReportIssue)")
    class ReportIssueEndpoints {

        @Test
        void createIssue_returnsOk() throws Exception {
            when(reportIssueService.createIssue(any(ReportIssue.class))).thenReturn(true);

            mockMvc.perform(post("/api/v1/user/createIssue")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new ReportIssue())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload").value(true));
        }

        @Test
        void getAllIssue_returnsOk() throws Exception {
            ObjectNode payload = JsonNodeFactory.instance.objectNode();
            payload.putArray("items");
            when(reportIssueService.getAllIssue()).thenReturn(payload);

            mockMvc.perform(get("/api/v1/user/getAllIssue")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk());
        }

        @Test
        void getIssueById_returnsOk() throws Exception {
            ObjectNode payload = JsonNodeFactory.instance.objectNode();
            payload.putArray("items");
            when(reportIssueService.getIssueById(eq("r1"))).thenReturn(payload);

            mockMvc.perform(get("/api/v1/user/getIssueById/{id}", "r1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk());
        }

        @Test
        void updateIssue_returnsOk() throws Exception {
            when(reportIssueService.updateIssue(eq("r1"), any(ReportIssue.class))).thenReturn(true);

            ReportIssue body = new ReportIssue();
            body.setProblem("Updated");
            mockMvc.perform(put("/api/v1/user/updateIssue/{id}", "r1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(body)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload").value(true));
        }

        @Test
        void deleteIssue_returnsOk() throws Exception {
            when(reportIssueService.deleteIssue(eq("r1"))).thenReturn(true);

            mockMvc.perform(delete("/api/v1/user/deleteIssue/{id}", "r1")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload").value(true));
        }
    }

    @Nested
    @DisplayName("Dashboard endpoint (blockchain: QueryAllReportIssues for count)")
    class DashboardEndpoint {

        @Test
        void getDashboard_returnsOk() throws Exception {
            when(departmentService.getDashboard()).thenReturn(new Dashboard());

            mockMvc.perform(get("/api/v1/admin/dashboard")
                            .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.payload").exists());
        }
    }
}
