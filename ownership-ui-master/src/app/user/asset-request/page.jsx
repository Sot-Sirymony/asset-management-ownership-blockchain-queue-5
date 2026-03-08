"use client";

import {  SearchOutlined } from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import {Input, Space, Table, Button} from "antd";
import "../../../styles/globals.css"
import { useEffect, useState } from "react";
import UpdateAssetRequest from "../../components/components/UpdateAssetRequest";
import DeleteAssetPopup from "../../components/components/DeleteAssetPopup";
import CreateAssetRequest from "../../components/components/CreateAssetRequest";
import Filter from "../../components/components/Filter";
import ViewRequestAsset from "../../components/components/ViewRequest";
import { useSession } from "next-auth/react";
import { userGetAllRequest } from "../../components/service/assetRequest.service";
import formatDate from "../../utils/formatDate";

export default function CategoryList() {
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
  const [searchText, setSearchText] = useState("");

  const paginationConfig = {
    pageSizeOptions: ['10', '20', '50'],
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
  const [isDeleteVisible, setIsDeleteVisible] = useState(false);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isUpdateVisible, setIsUpdateVisible] = useState(false);
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [isFilterVisible, setIsfilterVisible] = useState(false)
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [assetRequest, SetAssetRequest] = useState([])
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1); 
};

  //filter
  const handleFilterClick = () => {
    setIsfilterVisible(true);
  };

  // create
  const handleCreateClick = () => {
    setIsCreateVisible(true);
  };
  const handleViewClick = (record) => {
    setSelectedRecord(record);
    setIsPopupVisible(true);
  };
  const handleDeleteClick = (requestId) => {
    setSelectedRecord(requestId)
    setIsDeleteVisible(true);
  };
  const handleUpdateClick = (record) => {
    setSelectedRecord(record);
    setIsUpdateVisible(true);
  };

  const closeCreate = () => {
    setIsCreateVisible(false);
  };

  const closeFilter = () => {
    setIsfilterVisible(false);
  };

  const closeUpdate = () => {
    setIsUpdateVisible(false);
    handleRefresh()
  };

  const closeDelete = () => {
    // await deleteAsssetRequestById(token, record);
    setIsDeleteVisible(false);
  };
  const closeView = () => {
    setIsPopupVisible(false);
    setSelectedRecord(null);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    const filteredData = assetRequest.filter((item) =>
        item.assetName.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredRequests(filteredData); 
};



  const handleGetRequest = async () => {
    const allAssetRequest = await userGetAllRequest(token);
    const formattedDepartments = allAssetRequest.map((request, index) => ({
      ...request,
      id: index + 1,
      createdAt: formatDate(request.createdAt),
      profileImg: request.user?.profileImg,
      assetName: request.assetName,
      fullName: request.user?.fullName || "jonh",
      email: request.user?.email || "user@example.com",
      attachment: request && request?.attachment == "string" ? "https://img.freepik.com/premium-photo/mystery-box-question-mark-sign-3d-element_118019-5025.jpg" : request.attachment,
      department: request.user?.department?.dep_name || "Unknown Department",
      status: request.status || "PENDING",
    }));
    SetAssetRequest(formattedDepartments)
    setFilteredRequests(formattedDepartments)
  }

  const handleFilteredRequests = (requests) => {
    return requests.filter(request => {
      let matchesFilter = true;

      // Date filter
      if (filterCriteria.date) {
        const requestDate = new Date(request.createdAt).toLocaleDateString();
        const filterDate = new Date(filterCriteria.date).toLocaleDateString();
        matchesFilter = matchesFilter && requestDate === filterDate;
      }

      // Condition filter (if you have a condition field in your data)
      if (filterCriteria.condition && filterCriteria.condition !== "Select your condition") {
        matchesFilter = matchesFilter && request.condition === filterCriteria.condition;
      }

      // User filter
      if (filterCriteria.userId) {
        matchesFilter = matchesFilter && request.user?.id === filterCriteria.userId;
      }

      return matchesFilter;
    });
  };

  useEffect(() => {
    handleGetRequest();
  }, [token,refreshTrigger]);

  useEffect(() => {
    if (assetRequest.length > 0) {
      const filtered = handleFilteredRequests(assetRequest);
      setFilteredRequests(filtered);
    }
  }, [filterCriteria, assetRequest]);
  
  const handleFilterSave = (filterData) => {
    setFilterCriteria({
      date: filterData.selectedDate,
      condition: filterData.selectedCondition,
      userId: filterData.selectedUserId
    });
    setIsfilterVisible(false);
  };


  const totalItems = tableProps?.pagination?.total;

  return (
    <>
      <div className="bg-white w-full h-full p-10 rounded-xl ">
        <div className="mb-9 flex justify-between items-end">
          <div className="flex items-center">
            <Button onClick={handleFilterClick} className="!bg-[#F8FAFC] max-w-32 w-24 !h-10">
              <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.38975 0.635418C0.52285 0.635418 -0.412097 2.98516 0.908001 4.3594L6.14678 9.81305L6.14678 14.2695C6.14678 14.9562 6.45732 15.6027 6.98498 16.0147L9.91869 18.3052C10.9548 19.1142 12.4333 18.3446 12.4333 16.9964L12.4333 9.81305L17.6721 4.3594C18.9922 2.98516 18.0572 0.635418 16.1903 0.635418H2.38975Z" fill="#737791" />
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
          <Button onClick={handleCreateClick} className="!bg-[#4B68FF] !text-white !font-semibold w-36 !h-10">
            Request New
            <svg width="22" height="23" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.0005 0.968754C5.11904 0.968754 0.345703 5.74742 0.345703 11.6354C0.345703 17.5234 5.11904 22.3021 11.0005 22.3021C16.8819 22.3021 21.6552 17.5234 21.6552 11.6354C21.6552 5.74742 16.8819 0.968754 11.0005 0.968754ZM16.3278 12.7021H12.0659V16.9688H9.93499V12.7021H5.67308V10.5688H9.93499V6.30209H12.0659V10.5688H16.3278V12.7021Z" fill="white" />
            </svg>

          </Button>
        </div>
        <Table dataSource={filteredRequests} rowKey="id"
          pagination={{
            ...paginationConfig,
            total: totalItems,
          }}
        >
          <Table.Column dataIndex="id" title={"No"} width={"10px"} />
          <Table.Column
            dataIndex="assetName"
            title={"Asset Name"}
            render={(_, record) => (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src={record.attachment} alt={record.assetName} className="w-[40px] h-[40px] rounded-xl mr-2" />
                {record.assetName}
              </div>
            )}
          />
          <Table.Column dataIndex="qty" title={"QTY"} width={"100px"} />
          <Table.Column dataIndex="reason" title={"Reason"} />
          <Table.Column dataIndex="department" title={"Department"} />
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
          <Table.Column dataIndex="createdAt" title={"Request Date"} />
          <Table.Column
            width={"100px"}
            title={"Actions"}
            dataIndex="actions"
            render={(_, record) => (
              <Space>
                <button onClick={() => handleViewClick(record)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.9095 13.7126C2.56793 12.9695 2.56793 12.1122 2.9095 11.3691C4.4906 7.92927 7.96659 5.54085 12.0004 5.54085C16.0343 5.54085 19.5102 7.92928 21.0913 11.3691C21.4329 12.1122 21.4329 12.9695 21.0913 13.7126C19.5102 17.1524 16.0343 19.5408 12.0004 19.5408C7.96659 19.5408 4.4906 17.1524 2.9095 13.7126Z" stroke="#5B636D" stroke-width="2" />
                    <path d="M15.0004 12.5408C15.0004 14.1977 13.6573 15.5408 12.0004 15.5408C10.3436 15.5408 9.00042 14.1977 9.00042 12.5408C9.00042 10.884 10.3436 9.54085 12.0004 9.54085C13.6573 9.54085 15.0004 10.884 15.0004 12.5408Z" stroke="#5B636D" stroke-width="2" />
                  </svg>
                </button>
                <button onClick={() => handleUpdateClick(record)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 4.54085H4C3.46957 4.54085 2.96086 4.75156 2.58579 5.12663C2.21071 5.50171 2 6.01041 2 6.54085V20.5408C2 21.0713 2.21071 21.58 2.58579 21.9551C2.96086 22.3301 3.46957 22.5408 4 22.5408H18C18.5304 22.5408 19.0391 22.3301 19.4142 21.9551C19.7893 21.58 20 21.0713 20 20.5408V13.5408" stroke="#14AE5C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M18.5 3.04085C18.8978 2.64302 19.4374 2.41953 20 2.41953C20.5626 2.41953 21.1022 2.64302 21.5 3.04085C21.8978 3.43867 22.1213 3.97824 22.1213 4.54085C22.1213 5.10345 21.8978 5.64302 21.5 6.04085L12 15.5408L8 16.5408L9 12.5408L18.5 3.04085Z" stroke="#14AE5C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteClick(record.requestId)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 25"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 6.54085H5H21"
                      stroke="#EC221F"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M8 6.54085V4.54085C8 4.01041 8.21071 3.50171 8.58579 3.12663C8.96086 2.75156 9.46957 2.54085 10 2.54085H14C14.5304 2.54085 15.0391 2.75156 15.4142 3.12663C15.7893 3.50171 16 4.01041 16 4.54085V6.54085M19 6.54085V20.5408C19 21.0713 18.7893 21.58 18.4142 21.9551C18.0391 22.3301 17.5304 22.5408 17 22.5408H7C6.46957 22.5408 5.96086 22.3301 5.58579 21.9551C5.21071 21.58 5 21.0713 5 20.5408V6.54085H19Z" stroke="#EC221F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 11.5408V17.5408" stroke="#EC221F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 11.5408V17.5408" stroke="#EC221F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </Space>
            )}
          />
        </Table>
      </div>
      {isPopupVisible && <ViewRequestAsset record={selectedRecord} onClose={closeView} />}
      {isDeleteVisible && <DeleteAssetPopup requestId={selectedRecord}  onClose={closeDelete} onUpdate={handleRefresh}/>}
      {isUpdateVisible && <UpdateAssetRequest record={selectedRecord} onClose={closeUpdate} onUpdate={handleRefresh}/>}
      {isCreateVisible && <CreateAssetRequest onClose={closeCreate} />}
      {isFilterVisible && <Filter onClose={closeFilter} onSave={handleFilterSave}
      initialFilters={filterCriteria}/>}
    </>
  );
}
