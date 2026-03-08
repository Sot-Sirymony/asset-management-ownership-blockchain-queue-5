"use client";

import { SearchOutlined } from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Input, Space, Table, Button, Tooltip, Modal } from "antd";
import React, { useEffect, useState } from "react";
import Filter from "../../components/components/Filter";
import ViewRequestAsset from "../../components/components/ViewRequest";
import "../../../styles/globals.css";
import { getAllAssetRequest } from "../service/assetRequest.service";
import formatDate from "../../utils/formatDate";
import { useSession } from "next-auth/react";

export default function AssetRequestListClient() {
  const [searchText, setSearchText] = useState("");
  const [isfilterVisible, setIsfilterVisible] = useState(false);
  const [isViewVisible, setIsViewVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [assetRequest, setAssetRequest] = useState([])
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: session } = useSession();
  const token = session?.accessToken;


  const [filterCriteria, setFilterCriteria] = useState({
    date: "",
    condition: "",
    userId: null
  });

  const { tableProps } = useTable({
    syncWithLocation: true,
  });

  const handleFilterSave = (filterData) => {
    setFilterCriteria({
      date: filterData.selectedDate,
      condition: filterData.selectedCondition === "Select your condition" ? "" : filterData.selectedCondition,
      userId: filterData.selectedUserId
    });
    setIsfilterVisible(false);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    applyFilters(assetRequest, value, filterCriteria);
  };

  const applyFilters = (requests, searchValue, criteria) => {
    let filtered = [...requests];

    // Apply search filter
    if (searchValue) {
      filtered = filtered.filter((item) =>
        item.assetName.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    // Apply user filter
    if (criteria.userId) {
      console.log("reqeust userid", criteria.userId)
      filtered = filtered.filter(request => String(request.userId) === String(criteria.userId));
    }

    // Apply date filter
    if (criteria.date) {
      const filterDate = new Date(criteria.date).toDateString();
      filtered = filtered.filter(request => {
        const requestDate = new Date(request.createdAt).toDateString();
        return requestDate === filterDate;
      });
    }

    // Apply condition filter
    if (criteria.condition) {
      filtered = filtered.filter(request =>
        request.condition.toLowerCase() === criteria.condition.toLowerCase()
      );
    }

    setFilteredRequests(filtered);
  };


  const paginationConfig = {
    pageSizeOptions: ["10", "20", "50"],
    showTotal: (total, range) => (
      <span>
        <span className="text-[#cecece]">show:</span> {range[1]} of {total}
      </span>
    ),
    onChange: (page, pageSize) => {
      if (tableProps.pagination?.onChange) {
        tableProps.pagination.onChange(page, pageSize);
      }
    },
    position: ["bottomLeft"],
    className: "custom-pagination",
  };

  const fetchDepartments = async () => {
    try {
      if (token) {
        const allAssetRequest = await getAllAssetRequest(token);
        const formattedDepartments = allAssetRequest.map(request => ({
          ...request,
          createdAt: formatDate(request.createdAt),
          assetName: request.assetName,
          attachment: request.attachment,
          user: request.user?.username || "Unknown User",
          fullName: request.user?.fullName || "jonh",
          userId: request.user?.userId || null,
          email: request.user?.email || "user@example.com",
          profileImg: request.user?.profileImg || "/default-avatar.png",
          department: request.user?.department?.dep_name || "Unknown Department",
          status: request.status || "PENDING",
        }));
        setAssetRequest(formattedDepartments);
        applyFilters(formattedDepartments, searchText, filterCriteria);

      } else {
        console.warn("No token found");
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [token, refreshTrigger]);

  useEffect(() => {
    applyFilters(assetRequest, searchText, filterCriteria);
  }, [filterCriteria, assetRequest]);



  const handleViewClick = (record) => {
    setSelectedRecord(record);
    setIsViewVisible(true);
  };

  const closeView = () => {
    setIsViewVisible(false);
    setSelectedRecord(null);
  };

  const handleFilterClick = () => {
    setIsfilterVisible(true);
  };

  const closeFilter = () => {
    setIsfilterVisible(false);
  };

  const totalItems = tableProps?.pagination?.total;

  return (
    <section className={"mx-[20px] mt-[15px]"}>
      <div className="bg-white w-full h-full p-10 rounded-xl">
        <div className="mb-9 flex justify-between items-end">
          <div className="flex items-center">
            <Button
              onClick={handleFilterClick}
              className="!bg-[#F8FAFC] max-w-32 w-24 !h-10"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 19 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.38975 0.635418C0.52285 0.635418 -0.412097 2.98516 0.908001 4.3594L6.14678 9.81305L6.14678 14.2695C6.14678 14.9562 6.45732 15.6027 6.98498 16.0147L9.91869 18.3052C10.9548 19.1142 12.4333 18.3446 12.4333 16.9964L12.4333 9.81305L17.6721 4.3594C18.9922 2.98516 18.0572 0.635418 16.1903 0.635418H2.38975Z"
                  fill="#737791"
                />
              </svg>
              Filter
            </Button>
            <Input
              placeholder="Search categories"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 350 }}
              className="!bg-[#F8FAFC] mx-5 !h-10"
            />
          </div>
        </div>
        <Table
          // {...tableProps}
          dataSource={filteredRequests}
          rowKey="id"
          pagination={{
            ...paginationConfig,
            total: totalItems,
          }}
        >
          <Table.Column dataIndex="requestId" title={"No"} width={"10px"} />
          <Table.Column
            dataIndex="assetName"
            title={"Asset Name"}
            render={(_, record) => (
              <div style={{ display: "flex", alignItems: "center" }}>
                <img
                  src={record.attachment}
                  alt={record.assetName}
                  className="w-[40px] h-[40px] rounded-xl mr-2"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-[#273240] text-[16px]">
                    {record.assetName}
                  </span>
                  <span className="text-xs text-[#BCBCBC] text-[12px]">
                    {record.type}
                  </span>
                </div>
              </div>
            )}
          />
          <Table.Column dataIndex="qty" title={"QTY"} width={"100px"} />
          <Table.Column
            dataIndex="reason"
            title={"Reason"}
            render={(reason) => (
              <Tooltip title={reason}>
                <span
                  className="inline-claim-1"
                  style={{
                    display: "inline-block",
                    maxWidth: "250px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {reason}
                </span>
              </Tooltip>
            )}
          />
          <Table.Column
            dataIndex="assignedTo"
            title={"Previous Owner"}
            render={(_, record) => (
              <div style={{ display: "flex", alignItems: "center" }}>
                <img
                  src={record.profileImg}
                  alt={record.assignedTo}
                  className="w-[40px] h-[40px] object-fit rounded-full mr-2"
                />
                <div className="flex flex-col">
                  <span className="font-medium">{record.fullName}</span>
                  <span className="text-xs text-[#9399a3]">
                    {record.department}
                  </span>
                </div>
              </div>
            )}
          />
          <Table.Column dataIndex="createdAt" title={"Request Date"} />
          <Table.Column
            dataIndex="status"
            title={"Status"}
            width={"120px"}
            render={(status) => {
              const s = (status || "PENDING").toUpperCase();
              const color = s === "ASSIGNED" ? "#14AE5C" : s === "REJECTED" ? "#EC221F" : "#F59E0B";
              return <span style={{ color, fontWeight: 600 }}>{s === "ASSIGNED" ? "Assigned" : s === "REJECTED" ? "Rejected" : "Pending"}</span>;
            }}
          />
          <Table.Column
            width={"140px"}
            align="center"
            title={"Action"}
            dataIndex="action"
            render={(_, record) => (
              <Space>
                <Tooltip title="View details">
                  <button
                    onClick={() => handleViewClick(record)}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.9095 13.7126C2.56793 12.9695 2.56793 12.1122 2.9095 11.3691C4.4906 7.92927 7.96659 5.54085 12.0004 5.54085C16.0343 5.54085 19.5102 7.92928 21.0913 11.3691C21.4329 12.1122 21.4329 12.9695 21.0913 13.7126C19.5102 17.1524 16.0343 19.5408 12.0004 19.5408C7.96659 19.5408 4.4906 17.1524 2.9095 13.7126Z" stroke="#5B636D" strokeWidth="2" />
                      <path d="M15.0004 12.5408C15.0004 14.1977 13.6573 15.5408 12.0004 15.5408C10.3436 15.5408 9.00042 14.1977 9.00042 12.5408C9.00042 10.884 10.3436 9.54085 12.0004 9.54085C13.6573 9.54085 15.0004 10.884 15.0004 12.5408Z" stroke="#5B636D" strokeWidth="2" />
                    </svg>
                  </button>
                </Tooltip>
                <Tooltip title="Edit: Assign or Reject">
                  <button
                    onClick={() => handleViewClick(record)}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 4.54085H4C3.46957 4.54085 2.96086 4.75156 2.58579 5.12663C2.21071 5.50171 2 6.01041 2 6.54085V20.5408C2 21.0713 2.21071 21.58 2.58579 21.9551C2.96086 22.3301 3.46957 22.5408 4 22.5408H18C18.5304 22.5408 19.0391 22.3301 19.4142 21.9551C19.7893 21.58 20 21.0713 20 20.5408V13.5408" stroke="#14AE5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 3.04085C18.8978 2.64302 19.4374 2.41953 20 2.41953C20.5626 2.41953 21.1022 2.64302 21.5 3.04085C21.8978 3.43867 22.1213 3.97824 22.1213 4.54085C22.1213 5.10345 21.8978 5.64302 21.5 6.04085L12 15.5408L8 16.5408L9 12.5408L18.5 3.04085Z" stroke="#14AE5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </Tooltip>
              </Space>
            )}
          />
        </Table>
      </div>
      {isViewVisible && (
        <ViewRequestAsset
          record={selectedRecord}
          onClose={closeView}
          token={token}
          onStatusUpdated={() => { setRefreshTrigger((t) => t + 1); closeView(); }}
        />
      )}
      {isfilterVisible && <Filter onClose={closeFilter} onSave={handleFilterSave}
      initialFilters={filterCriteria} />}
    </section>
  );
}
