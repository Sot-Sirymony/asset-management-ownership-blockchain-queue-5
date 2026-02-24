"use client";
import { React, useState, useEffect } from "react";
import { Layout, Menu, Table, Card, Row, Col, Dropdown, Button, Space, Avatar } from "antd";
import { List } from "@refinedev/antd";
import Image from "next/image";
import TotalUser from "../../components/app-icon/total-user.svg";
import TotalAssetRequest from "../../components/app-icon/total-asset-request.svg";
import TotalReportIssue from "../../components/app-icon/total-report-issue.svg";
import TotalDepartment from "../../components/app-icon/Total-Department.svg";
import { getAllAssetRequest } from "../service/assetRequest.service";
import { getDashboardCount } from "../service/department.service";
import { getAllReport } from "../service/report.service"
import { useSession } from "next-auth/react";
import assetData from "../../utils/asset.json";
import ProfileDropdown from "../components/ProfileDropdown";

const columns = [
    {
        title: <span className="text-gray-500">No</span>,
        dataIndex: "index",
        key: "index",
        width: "100px",
        align: "center",
    },
    {
        title: <span className="text-gray-500">Asset Name</span>,
        dataIndex: ["attachment", "assetName"],
        key: "asset",
        render: (_, record) => (
            <Space>
                <img src={record.attachment} alt={record.assetName} className="w-[40px] h-[40px] rounded-xl mr-2" />
                <span>{record.assetName}</span>
            </Space>
        ),
    },
    {
        title: <span className="text-gray-500">Reason</span>,
        dataIndex: "reason",
        key: "reason",
        render: (text) => (
            <div className="overflow-hidden line-clamp-1 flex-col-reverse justify-start">{text}</div>
        ),
    },
];

const reportIssueColumns = [
    {
        title: <span className="text-gray-500">No</span>,
        dataIndex: "index",
        key: "index",
        width: "100px",
        align: "center",
    },
    {
        title: <span className="text-gray-500">Asset Name</span>,
        dataIndex: ["attachment", "assetName"],
        key: "asset",
        render: (_, record) => (
            <Space>
                <img src={record.attachment} alt={record.assetName} className="w-[40px] h-[40px] rounded-xl mr-2" />
                <span>{record.assetName}</span>
            </Space>
        ),
    },
    {
        title: <span className="text-gray-500">Problem</span>,
        dataIndex: "problem",
        key: "problem",
        render: (text) => (
            <div className="overflow-hidden line-clamp-1 flex-col-reverse justify-start">{text}</div>
        ),
    },
];

export default function DashboardClient(userId) {
    const [assetRequest, setAssetRequest] = useState([])
    const [report, setReport] = useState([])
    const [dashboardCount, setDashboardCount] = useState(null)
    const { data: session } = useSession();
    const token = session?.accessToken;
    const fetchDepartments = async () => {
        try {
            if (token) {
                const allAssetRequest = await getAllAssetRequest(token);
                const transformedData = allAssetRequest.map((item, index) => ({
                    ...item, 
                    index: index + 1, 
                }));
                setAssetRequest(transformedData);

            } else {
                console.warn("No token found");
            }
        } catch (error) {
            console.error("Error fetching departments:", error);
        }
    };

    const fetchDashboard = async () => {
        try {
            if (token) {
                const allCountDashboard = await getDashboardCount(token);
                setDashboardCount(allCountDashboard);
            } else {
                console.warn("No token found for dashboard");
            }
        } catch (error) {
            console.error("Error fetching dashboard:", error);
            setDashboardCount(null);
        }
    }

    const fetchReport = async () => {
        const allReport = await getAllReport(token)
        const transformedData = allReport.map((item, index) => ({
            ...item, 
            index: index + 1, 
        }));
        setReport(transformedData)
    }

    useEffect(() => {
        fetchDepartments();
        fetchDashboard()
        fetchReport()
    }, [token]);
    return (
        <div data-testid="dashboard-content">
        <List
            title={<span style={{ fontSize: '27px', color: '#151D48', fontWeight: '600' }}>Dashboard</span>}
            canCreate={false}
            headerButtons={() => (
                <Space>
                    <ProfileDropdown userId={userId}/>
                </Space>
            )}
        >
            <Row gutter={16} className={"px-[20px] py-[10px]"}>
                <Col span={6}>
                    <Card bordered={false}>
                        <div className="px-5 flex justify-between items-start">
                            <div className="flex flex-col ">
                                <span className="uppercase text-[12px] font-medium text-[#626C70]">Total Users</span>
                                <span className="block text-[20px] font-semibold">                        
                                    {dashboardCount !== null && dashboardCount !== undefined ? dashboardCount.totalUser : "Loading..."}
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Image src={TotalUser} alt={"Total Users"} />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col span={6}>
                    <Card bordered={false}>
                        <div className="px-5 flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="uppercase text-[12px] font-medium text-[#626C70]">Total Asset Request</span>
                                <span className="block text-[20px] font-semibold">
                                    {dashboardCount !== null && dashboardCount !== undefined ? dashboardCount.totalAssetRequest : "Loading..."}
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Image src={TotalAssetRequest} alt={"Total Asset Request"} />
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <div className="px-5 flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="uppercase text-[12px] font-medium text-[#626C70]">Total Report Issue</span>
                                <span className="block text-[20px] font-semibold">
                                {dashboardCount !== null && dashboardCount !== undefined ? dashboardCount.totalReportIssue : "Loading..."}
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Image src={TotalReportIssue} alt={"Total Report Issue"} />
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col span={6}>
                    <Card bordered={false}>
                        <div className="px-5 flex justify-between items-start">
                            <div className="flex flex-col">
                                <span className="uppercase text-[12px] font-medium text-[#626C70]">Total Department</span>
                                <span className="block text-[20px] font-semibold">
                                    {dashboardCount !== null && dashboardCount !== undefined ? dashboardCount.totalDepartment : "Loading..."}
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Image src={TotalDepartment} alt={"Total Department"} />
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={16} className={"pt-2 pl-[20px] mt-[24px]"}>
                <Col span={12}>
                    <Card title="Asset Request" bordered={false}>
                        <Table
                            className="text-gray-800 px-[3rem] justify-center"
                            columns={columns}
                            dataSource={assetRequest.slice(0, 5)}
                            pagination={false}
                            rowClassName={() => 'text-gray-800'}
                        />
                    </Card>
                </Col>
                <Col span={12} style={{ paddingInlineEnd: "20px" }}>
                    <Card title="Report Issue" bordered={false}>
                        <Table
                            className="text-gray-800 px-[3rem]"
                            columns={reportIssueColumns}
                            dataSource={report.slice(0,5)}
                            pagination={false}
                            rowClassName={() => 'text-gray-800'}
                        />
                    </Card>
                </Col>
            </Row>
        </List>
        </div>
    );
}
