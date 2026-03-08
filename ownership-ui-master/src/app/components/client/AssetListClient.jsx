"use client";

import { SearchOutlined } from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import { Input, Space, Table, Typography, Button } from "antd";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DeletePopup from "../../components/components/DeletePopup";
import TransferAssetPopup from "../../components/components/TransferAssetPopup";
import Filter from "../../components/components/Filter";
import Image from "next/image";
import ViewDetail from "../../components/app-icon/view-detail.svg";
import DeletePop from "../../components/app-icon/trash-pop.svg";
import EditIcon from "../../components/app-icon/edit-icon.svg";
import { formatDateBC } from "../../utils/formatDate";
import { getAllAsset } from "../service/asset.service";
import { useSession } from "next-auth/react";
import "../../../styles/globals.css"
import Loading from "../components/Loading";

export default function AssetListClient() {
    const [searchText, setSearchText] = useState("");
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const [isFilterVisible, setIsfilterVisible] = useState(false);
    const [isTransferVisible, setIstransferVisible] = useState(false);
    const { data: session } = useSession();
    const token = session?.accessToken;
    const [asset, setAsset] = useState([])
    const [selectedAssetId, setSelectedAssetId] = useState(null);
    const [loading, setLoading] = useState(false)
    const [filteredAssets, setFilteredAssets] = useState([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState(null);

    const [filterCriteria, setFilterCriteria] = useState({
        date: "",
        condition: "",
        userId: null
      });


    const { tableProps } = useTable({ syncWithLocation: true });
    const router = useRouter();

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

    const handleView = (id) => {
        router.push(`/admin/asset/show/${id}`);
    };

    const handleEdit = (id) => {
        router.push(`/admin/asset/edit/${id}`);
    };

    const handleCreate = () => {
        router.push(`/admin/asset/create/`);
    };

    const handleTransferClick = (assetId, ownerId) => {
        setSelectedAssetId(assetId);
        setSelectedOwnerId(ownerId ? Number(ownerId) : null);
        setIstransferVisible(true);
    };

    const closeTransfer = () => {
        setIstransferVisible(false);
        setSelectedAssetId(null);
        setSelectedOwnerId(null);
    };

    const handleDeleteClick = (assetId) => {
        console.log("dlete", assetId)
        setSelectedAssetId(assetId)
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

    const totalItems = tableProps?.pagination?.total;


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
                const requestDate = new Date(request.assignDate).toLocaleDateString('en-CA'); // Local time zone date
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


    const fetchAllAsset = async () => {
        setLoading(true);
        try {
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
            }));
            setAsset(formattedAsset);
            applyFilters(formattedAsset, searchText, filterCriteria);
        } catch (error) {
            console.error("Failed to fetch assets:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAllAsset()
    }, [token])

    useEffect(() => {
        applyFilters(asset, searchText, filterCriteria);
      }, [filterCriteria, asset]);

    return (
        <section className="mx-[20px] mt-[15px]">
            {loading ? (
                <Loading />
            ) : (
                <div className="bg-white w-full h-full p-10 rounded-xl ">

                    <div className="mb-9 flex justify-between items-end">
                        <div className="flex items-center">
                            <Button onClick={handleFilterClick} className="!bg-[#F8FAFC] max-w-32 w-24 !h-10">
                                <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                        <Button onClick={handleCreate} className="!bg-[#4B68FF] !text-white !font-semibold w-36 !h-10">
                            Assign New
                            <svg width="22" height="23" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M11.0005 0.968754C5.11904 0.968754 0.345703 5.74742 0.345703 11.6354C0.345703 17.5234 5.11904 22.3021 11.0005 22.3021C16.8819 22.3021 21.6552 17.5234 21.6552 11.6354C21.6552 5.74742 16.8819 0.968754 11.0005 0.968754ZM16.3278 12.7021H12.0659V16.9688H9.93499V12.7021H5.67308V10.5688H9.93499V6.30209H12.0659V10.5688H16.3278V12.7021Z"
                                    fill="white"
                                />
                            </svg>
                        </Button>
                    </div>

                    <Table
                        dataSource={filteredAssets}
                        rowKey="id"
                        pagination={{
                            pageSizeOptions: ["10", "20", "50"],
                            showTotal: (total, range) => (
                                <span>
                                    <span className="text-[#cecece]">show:</span> {range[1]} of {total}
                                </span>
                            ),
                            position: ["bottomLeft"],
                            className: "custom-pagination",
                            total: totalItems,
                        }}
                    >
                        <Table.Column dataIndex="id" title={"No"} width={"10px"} />
                        <Table.Column
                            dataIndex="assetName"
                            title={"Asset Name"}
                            render={(_, record) => (
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <img src={record.attachment} alt={record.assetName} className="w-[40px] h-[40px] rounded-xl mr-2" />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-[#273240] text-[16px]">{record.assetName}</span>
                                        <span className="text-xs text-[#BCBCBC] text-[12px]">{record.type}</span>
                                    </div>
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
                        <Table.Column
                            dataIndex="assignTo"
                            title={"Assign To"}
                            render={(_, record) => (
                                <div onClick={() => handleTransferClick(record.assetId, record.assignTo?.userId)} className="flex items-center">
                                    <img
                                        src={record.profileImg}
                                        alt={record.fullName}
                                        className="w-[40px] h-[40px] object-cover rounded-full mr-2"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{record.fullName}</span>
                                        <span className="text-xs text-[#9399a3]">{record.department}</span>
                                    </div>
                                </div>
                            )}
                        />
                        <Table.Column dataIndex="assignDate" title={"Assign Date"} />
                        <Table.Column
                            width={"100px"}
                            title={"Actions"}
                            dataIndex="actions"
                            render={(_, record) => (
                                <Space>
                                    <button type="button" onClick={() => handleView(record.assetId)} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="View asset detail" data-testid="view-asset-detail">
                                        <Image src={ViewDetail} alt={"view-detail-icon"} />
                                    </button>
                                    <button onClick={() => handleEdit(record.assetId)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                        <Image src={EditIcon} alt={"edit-icon"} />
                                    </button>
                                    <button onClick={() => handleDeleteClick(record.assetId)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                        <Image src={DeletePop} alt={"delete-icon"} />
                                    </button>
                                </Space>
                            )}
                        />
                    </Table>

                </div>
            )}


            {isPopupVisible && <DeletePopup assetId={selectedAssetId} onClose={closePopup} />}
            {isFilterVisible && <Filter onClose={closeFilter} onSave={handleFilterSave} initialFilters={filterCriteria}/>}
            {isTransferVisible && (
                <TransferAssetPopup
                    assetId={selectedAssetId}
                    currentOwnerId={selectedOwnerId}
                    onClose={closeTransfer}
                    onTransferSuccess={fetchAllAsset}
                />
            )}
        </section>
    );
}
