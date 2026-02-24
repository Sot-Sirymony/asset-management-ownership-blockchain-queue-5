package com.up.asset_holder_api.service.serviceImp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.up.asset_holder_api.exception.NotFoundException;
import com.up.asset_holder_api.gateway.FabricGatewayCache;
import com.up.asset_holder_api.helper.GatewayHelperV1;
import com.up.asset_holder_api.model.entity.Dashboard;
import com.up.asset_holder_api.model.entity.Department;
import com.up.asset_holder_api.model.request.DepartmentRequest;
import com.up.asset_holder_api.model.response.UserRequestResponse;
import com.up.asset_holder_api.repository.DepartmentRepository;
import com.up.asset_holder_api.repository.UserRepository;
import com.up.asset_holder_api.service.DepartmentService;
import com.up.asset_holder_api.utils.GetCurrentUser;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hyperledger.fabric.gateway.Contract;
import org.hyperledger.fabric.gateway.Gateway;
import org.hyperledger.fabric.gateway.Network;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Service implementation for department management operations.
 */
@Slf4j
@Service
@AllArgsConstructor
public class DepartmentServiceImp implements DepartmentService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String CHAINCODE =
            System.getenv().getOrDefault("FABRIC_CHAINCODE", "basic");

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final FabricGatewayCache gatewayCache;

    /**
     * Retrieves all departments with pagination.
     * Results are cached for 10 minutes.
     *
     * @param page Page number (1-based)
     * @param size Page size
     * @return List of departments
     */
    @Override
    @Cacheable(value = "departments", key = "'page_' + #page + '_size_' + #size")
    public List<Department> getAllDepartment(Integer page, Integer size) {
        log.debug("Fetching departments - page: {}, size: {}", page, size);
        return departmentRepository.findAllDepartment(page, size);
    }

    @Override
    public Department getDepartmentById(Integer departmentId) {
        Department department = departmentRepository.findDepartmentById(departmentId);
        if (department == null) throw new NotFoundException("Department not found");
        return department;
    }

    @Override
    public Boolean addDepartment(DepartmentRequest departmentRequest) {
        return departmentRepository.postDepartment(departmentRequest, LocalDateTime.now()) == 1;
    }

    @Override
    public Boolean updateDepartment(Integer id, DepartmentRequest departmentRequest) {
        return departmentRepository.updateDepartment(id, departmentRequest, LocalDateTime.now());
    }

    @Override
    public Boolean deleteDepartment(Integer id) {
        return departmentRepository.deleteDepartment(id);
    }

    @Override
    @Cacheable(cacheNames = "dashboardCounts", cacheManager = "blockchainCacheManager",
            key = "'dashboard_' + T(com.up.asset_holder_api.utils.GetCurrentUser).currentId()")
    public Dashboard getDashboard() {
        Integer userId = GetCurrentUser.currentId();
        UserRequestResponse user = userRepository.findUserById(userId);

        Integer totalUser = departmentRepository.findTotalUser();
        Integer totalAssetRequest = departmentRepository.findTotalAssetRequest();
        Integer totalDepartment = departmentRepository.findTotalDepartment();

        int reportIssueCount = 0;

        try {
            Gateway gateway = gatewayCache.getOrCreate(user.getUsername());
            Network network = GatewayHelperV1.getNetwork(gateway);
            Contract contract = network.getContract(CHAINCODE);
            byte[] result = contract.evaluateTransaction("QueryAllReportIssues");
            JsonNode issues = MAPPER.readTree(new String(result, StandardCharsets.UTF_8));
            if (issues != null && issues.isArray()) {
                reportIssueCount = issues.size();
            }
        } catch (Exception e) {
            log.error("Failed to retrieve report issues count for dashboard", e);
        }

        return new Dashboard(totalUser, totalAssetRequest, reportIssueCount, totalDepartment);
    }
}
