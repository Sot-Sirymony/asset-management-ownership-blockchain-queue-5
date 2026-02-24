package com.up.asset_holder_api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.up.asset_holder_api.configuration.BeanConfig;
import com.up.asset_holder_api.configuration.SecurityConfig;
import com.up.asset_holder_api.jwt.JwtAuthEntrypoint;
import com.up.asset_holder_api.jwt.JwtAuthFilter;
import com.up.asset_holder_api.jwt.JwtUtil;
import com.up.asset_holder_api.model.entity.Dashboard;
import com.up.asset_holder_api.model.entity.Department;
import com.up.asset_holder_api.model.request.DepartmentRequest;
import com.up.asset_holder_api.service.AppUserService;
import com.up.asset_holder_api.service.DepartmentService;
import com.up.asset_holder_api.testsupport.SecurityTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = DepartmentController.class)
@Import({SecurityConfig.class, BeanConfig.class, JwtAuthFilter.class, JwtAuthEntrypoint.class})
class DepartmentControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private DepartmentService departmentService;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private AppUserService appUserService;

    @BeforeEach
    void setupJwt() {
        SecurityTestSupport.mockJwtAsAdmin(jwtUtil, appUserService);
    }

    @Test
    void getAllDepartment_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/admin/department"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getAllDepartment_asAdmin_returnsOk() throws Exception {
        when(departmentService.getAllDepartment(anyInt(), anyInt()))
                .thenReturn(List.of(new Department(), new Department()));

        mockMvc.perform(get("/api/v1/admin/department")
                        .param("page", "1")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload").isArray());
    }

    @Test
    void createDepartment_asAdmin_returnsOk() throws Exception {
        when(departmentService.addDepartment(any(DepartmentRequest.class))).thenReturn(true);

        DepartmentRequest req = new DepartmentRequest();
        mockMvc.perform(post("/api/v1/admin/department")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload").value(true));
    }

    @Test
    void dashboard_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/admin/dashboard"))
                .andExpect(status().isUnauthorized());
    }

    /** Dashboard uses blockchain (QueryAllReportIssues) for report count. */
    @Test
    void dashboard_asAdmin_returnsOk() throws Exception {
        when(departmentService.getDashboard()).thenReturn(new Dashboard());

        mockMvc.perform(get("/api/v1/admin/dashboard")
                        .header("Authorization", "Bearer " + SecurityTestSupport.GOOD_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload").exists());
    }
}
