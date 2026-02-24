"use client";

import { DownOutlined, SearchOutlined } from "@ant-design/icons";
import {
  useTable,
} from "@refinedev/antd";
import { BaseRecord, useGetIdentity } from "@refinedev/core";
import { Avatar, Col, Input, Menu, Row, Space, Table } from "antd";
import { Typography, Dropdown, Button } from "antd";

import "../../../styles/globals.css"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DeletePopup from "../../components/components/DeletePopup";
import FilterPopup from "../../components/components/FilterPopup";
import { getAllAsset } from "../../components/service/asset.service";
import { formatDateBC } from "../../utils/formatDate";
import { useSession } from "next-auth/react";
import Loading from "../../components/components/Loading";
import Filter from "../../components/components/Filter";


export default function CategoryList() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [searchText, setSearchText] = useState("");
  const [asset, setAsset] = useState([])
  const [filteredAssets, setFilteredAssets] = useState([]);
    
  const { tableProps } = useTable({
    syncWithLocation: true,
  });
  const router = useRouter();
  


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




  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isFilterVisible, setIsfilterVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filteredRequests, setFilteredRequests] = useState([]);


  const handleDeleteClick = () => {
    setIsPopupVisible(true);
  };
  const handleFilterClick = () => {
    setIsfilterVisible(true);
  };

  const closePopup = () => {
    setIsPopupVisible(false);
  };
  const closeFilter = () => {
    setIsfilterVisible(false);
  };


  const handleView = (id) => {
    router.push(`/user/asset/show/${id}`);
  };



  const [filterCriteria, setFilterCriteria] = useState({
    date: "",
    condition: "",
    userId: null
  });


  const applyFilters = (requests, searchValue, criteria) => {
    let filtered = [...requests];

    // Apply search filter
    if (searchValue) {
        filtered = filtered.filter((item) =>
            item.assetName?.toLowerCase().includes(searchValue.toLowerCase())
        );
    }

    // Apply user filter
    if (criteria.userId) {
        filtered = filtered.filter(request => {
            console.log("Filtering by userId:", {
                requestUserId: request.assignTo.userId, 
                criteriaUserId: criteria.userId
            });
            return String(request.assignTo.userId) === String(criteria.userId);
        });
    }

    // Apply date filter
    if (criteria.date) {
        filtered = filtered.filter(request => {
            const requestDate = new Date(request.assignDate).toLocaleDateString('en-CA'); 
            const filterDate = new Date(criteria.date).toLocaleDateString('en-CA');
            
            console.log("Date Filtering:", {
                requestDate, 
                filterDate, 
                matches: requestDate === filterDate
            });
    
            return requestDate === filterDate;
        });
    }
    

    // Apply condition filter
    if (criteria.condition && criteria.condition !== "Select your condition") {
        filtered = filtered.filter(request =>
            request.condition?.toLowerCase() === criteria.condition.toLowerCase()
        );
    }

    console.log("Filtered Results:", filtered);
    setFilteredAssets(filtered);
};    



  const calculateDaysDifference = (assignDateString) => {
    // Remove timezone and milliseconds, parse the core timestamp
    const cleanDateString = assignDateString.split(' ')[0];
    const assignDate = new Date(cleanDateString);
    const currentDate = new Date();
    
    const timeDiff = currentDate.getTime() - assignDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    return daysDiff;
  };

  const fetchAllAsset = async () => {
    setLoading(true)
    try {
      console.log("fdsjfdsj")
      const allAsset = await getAllAsset(token);
      const formattedAsset = allAsset.map((asset, id) => ({
        ...asset,
        id: id + 1,
        assetName: asset.assetName,
        attachment: asset.attachment,
        assignDate: formatDateBC(asset.assignDate),
        fullName: asset.assignTo?.fullName || "Unknown",
        profileImg: asset.assignTo?.profileImg,
        department: asset.assignTo?.department,
        totalDay: calculateDaysDifference(asset.assignDate),
      }));
      console.log("allasset", allAsset)
      setAsset(formattedAsset)
      applyFilters(formattedAsset, searchText, filterCriteria);
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (value) => {
    setSearchText(value);
    applyFilters(asset, value, filterCriteria);
};

const handleFilterSave = (filterData) => {
    setFilterCriteria({
      date: filterData.selectedDate,
      condition: filterData.selectedCondition,
      userId: filterData.selectedUserId
    });
    setIsfilterVisible(false);
  };

  useEffect(() => {
    fetchAllAsset()
  }, [token])


  useEffect(() => {
    applyFilters(asset, searchText, filterCriteria);
  }, [filterCriteria, asset]);

  const totalItems = tableProps?.pagination?.total;

  return (
    <>
      <div>
        {loading ? (
          <Loading />
        ) : (
          <div className="bg-white w-full h-full p-10 rounded-xl ">

            {/* <Space style={{ marginRight: 'auto' }}> */}
            < div className="mb-9 flex justify-between items-end">
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
            </div>
            {/* </Space> */}
            <Table dataSource={filteredAssets} rowKey="id"
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
                    <img src={record.attachment} alt={record.assetName} className="w-[40px] h-[40px] rounded-lg mr-2" />
                    {record.assetName}
                  </div>
                )}
              />
              <Table.Column dataIndex="qty" title={"QTY"} width={"100px"} />
              <Table.Column
                dataIndex="condition"
                title={"Condition"}
                render={(condition) => {
                  let colorClass;
                  switch (condition) {
                    case "Good":
                      colorClass = "bg-emerald-50 text-emerald-700";
                      break;
                    case "Medium":
                      colorClass = "bg-orange-50 text-orange-700";
                      break;
                    case "Low":
                      colorClass = "bg-rose-50 text-rose-700";
                      break;
                    default:
                      colorClass = "bg-gray-50 text-gray-700";
                  }
                  return (
                    <span className={`px-3 py-1 text-sm font-medium rounded-lg ${colorClass}`}>
                      {condition}
                    </span>
                  );
                }}
              />
              <Table.Column dataIndex="assignDate" title={"Assigned Date"} />
              <Table.Column dataIndex="totalDay" title={"Total Day"} />
              <Table.Column
                width={"10px"}
                title={"Actions"}
                dataIndex="actions"
                render={(_, record) => (
                  <Space>
                    {/* <EditButton hideText size="small" recordItemId={record.id} /> */}
                    {/* <Button
                  size="small"
                  onClick={() => handleEdit(record.id)}
                > */}
                    {/* <ViewDetail onClick={() => handleEdit(record.id)} /> */}
                    <button type="button" onClick={() => handleView(record.assetId)} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="View asset detail" data-testid="view-asset-detail">
                      <svg width="20" height="20" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.9095 13.7126C2.56793 12.9695 2.56793 12.1122 2.9095 11.3691C4.4906 7.92927 7.96659 5.54085 12.0004 5.54085C16.0343 5.54085 19.5102 7.92928 21.0913 11.3691C21.4329 12.1122 21.4329 12.9695 21.0913 13.7126C19.5102 17.1524 16.0343 19.5408 12.0004 19.5408C7.96659 19.5408 4.4906 17.1524 2.9095 13.7126Z" stroke="#5B636D" stroke-width="2" />
                        <path d="M15.0004 12.5408C15.0004 14.1977 13.6573 15.5408 12.0004 15.5408C10.3436 15.5408 9.00042 14.1977 9.00042 12.5408C9.00042 10.884 10.3436 9.54085 12.0004 9.54085C13.6573 9.54085 15.0004 10.884 15.0004 12.5408Z" stroke="#5B636D" stroke-width="2" />
                      </svg>
                    </button>
                  </Space>
                )}
              />
            </Table>
          </div>
        )}
        {isPopupVisible && <DeletePopup onClose={closePopup} />}
        {isFilterVisible && <Filter onClose={closeFilter} onSave={handleFilterSave}
          initialFilters={filterCriteria} />}
      </div >
    </>
  );
}
