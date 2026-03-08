"use client";

import { SearchOutlined } from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Table, Button, Input, Tooltip } from "antd";
import { useEffect, useState } from "react";
import "../../../styles/globals.css";
import DeletePopup from "../../components/components/DeletePopup";
import UpdateDepartment from "../../components/components/UpdateDepartment";
import CreateDepartment from "../../components/components/CreateDapartment";
import Filter from "../../components/components/Filter";
import { getHistory } from "../service/history.service";
import { useSession } from "next-auth/react";
import Loading from "../components/Loading";
import { formatDateBCWithTime } from "../../utils/formatDate";

export default function HistoryClient() {

    const { data: session } = useSession();
    const token = session?.accessToken;

    const { tableProps } = useTable({
        syncWithLocation: true,
    });
    const [isCreateVisible, setIsCreateVisible] = useState(false);
    const [isDeleteVisible, setIsDeleteVisible] = useState(false);
    const [isUpdateVisible, setIsUpdateVisible] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)
    const [isFilterVisible, setIsfilterVisible] = useState(false)
    const [filteredHistory, setFilteredHistory] = useState([]);

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

    const handleCreateClick = () => setIsCreateVisible(true);
    const handleDeleteClick = () => setIsDeleteVisible(true);
    const handleEditClick = () => setIsUpdateVisible(true);
    const handleFilterClick = () => setIsfilterVisible(true);
    const handleSearch = (value) => {
        setSearchText(value);
        applyFilters(history, value, filterCriteria);
      };

    const closeCreate = () => setIsCreateVisible(false);
    const closeUpdate = () => setIsUpdateVisible(false);
    const closeDelete = () => setIsDeleteVisible(false);
    const closeFilter = () => setIsfilterVisible(false);

    const [filterCriteria, setFilterCriteria] = useState({
        date: "",
        condition: "",
        userId: null
      });
    
      const handleFilterSave = (filterData) => {
        setFilterCriteria({
          date: filterData.selectedDate,
          condition: filterData.selectedCondition,
          userId: filterData.selectedUserId
        });
        setIsfilterVisible(false);
      };
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
            const uid = request.assignTo?.userId ?? request.assignTo?.user_id;
            return uid != null && String(uid) === String(criteria.userId);
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
        setFilteredHistory(filtered);
      };
      useEffect(() => {
        applyFilters(history, searchText, filterCriteria);
      }, [filterCriteria, history]);

    /** Parse timestamp for sorting (handles Go time string). */
    const parseEventTime = (entry) => {
        const v = entry?.updated_at ?? entry?.created_at;
        if (v == null || v === '') return 0;
        const s = String(v).trim();
        const part = s.slice(0, 19).replace(' ', 'T');
        const d = new Date(part);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    /** Event time for display: use updated_at when set (transfer/update), else created_at. */
    const eventTime = (entry) => entry?.updated_at ?? entry?.created_at;

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const allHistory = await getHistory(token);
            const flattenedHistory = allHistory.flat();
            // Group by asset_id and sort by event time (oldest first) so reassignDate = next event's time
            const byAsset = {};
            flattenedHistory.forEach((entry) => {
                const aid = entry.asset_id || entry.assetId;
                if (!aid) return;
                if (!byAsset[aid]) byAsset[aid] = [];
                byAsset[aid].push(entry);
            });
            Object.keys(byAsset).forEach((aid) => {
                byAsset[aid].sort((a, b) => parseEventTime(a) - parseEventTime(b));
            });
            const withReassign = [];
            Object.values(byAsset).forEach((group) => {
                group.forEach((entry, i) => {
                    const next = group[i + 1];
                    withReassign.push({
                        ...entry,
                        assignDate: formatDateBCWithTime(eventTime(entry)),
                        reassignDate: next ? formatDateBCWithTime(eventTime(next)) : '',
                    });
                });
            });
            const formattedHistory = withReassign.map((asset, id) => ({
                ...asset,
                id: id + 1,
                assetName: asset.asset_name,
                attachment: asset.attachment,
                fullName: asset.assignTo?.fullName || "Unknown",
                profileImg: asset.assignTo?.profileImg,
                department: asset.assignTo?.department,
            }));
            setHistory(formattedHistory);
        } catch (error) {
            console.error("Failed to fetch assets:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory()
    }, [token])

    const totalItems = tableProps?.pagination?.total;

    return (
        <section className={"mx-[20px] mt-[15px]"}>
            {loading ? (
                <Loading />
            ) : (
                <div className="bg-white w-full h-full p-10 rounded-xl ">
                    <div className="mb-9 flex justify-between items-end">
                        <div className="flex items-center gap-5">
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
                                style={{ width: 350, margin: 0 }}
                                className="!bg-[#F8FAFC] mx-5 !h-10"
                            />
                        </div>
                    </div>
                    <Table
                        dataSource={filteredHistory}
                        rowKey="id"
                        pagination={{
                            ...paginationConfig,
                            total: totalItems,
                        }}
                    >
                        <Table.Column dataIndex="id" title={"No"} width={"10px"} />
                        <Table.Column
                            dataIndex="tx_id"
                            title={"Tx ID"}
                            width={120}
                            render={(txId, record) => {
                                const short = (txId && String(txId).slice(0, 12)) || "—";
                                const prev = record.previous_tx_id ? String(record.previous_tx_id).slice(0, 12) : "—";
                                const creation = record.creation_tx_id ? String(record.creation_tx_id).slice(0, 12) : "—";
                                return (
                                    <Tooltip title={<span style={{ whiteSpace: "pre-wrap" }}>{`This: ${txId || "—"}\nPrevious: ${record.previous_tx_id || "—"}\nCreation: ${record.creation_tx_id || "—"}`}</span>}>
                                        <span className="text-xs font-mono text-[#4B68FF]" title={txId}>{short}{txId && txId.length > 12 ? "…" : ""}</span>
                                    </Tooltip>
                                );
                            }}
                        />
                        <Table.Column
                            dataIndex="assetName"
                            title={"Assets"}
                            render={(_, record) => (
                                <div style={{ display: "flex", alignItems: "center" }}>
                                    <img
                                        src={record.attachment}
                                        alt={record.assetName}
                                        className="w-[40px] h-[40px] rounded-xl mr-2"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-sm">{record.assetName}</span>
                                        <span className="text-xs text-[#9399a3]">{record.type}</span>
                                    </div>
                                </div>
                            )}
                        />
                        <Table.Column dataIndex="assignDate" title={"Assigned Date"} />
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
                        <Table.Column dataIndex="reassignDate" title={"Reassign Date"} />
                    </Table>
                </div>
            )}
            {isCreateVisible && <CreateDepartment onClose={closeCreate} />}
            {isDeleteVisible && <DeletePopup onClose={closeDelete} />}
            {isUpdateVisible && <UpdateDepartment onClose={closeUpdate} />}
            {isFilterVisible && <Filter onClose={closeFilter} onSave={handleFilterSave}
          initialFilters={filterCriteria}/>}

        </section>
    );
}
