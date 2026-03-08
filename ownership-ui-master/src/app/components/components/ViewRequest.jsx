"use client";

import React, { useState } from "react";
import Link from "next/link";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import { updateRequestStatus, approveAndCreateAsset } from "../service/assetRequest.service";

export default function ViewRequestAsset({ onClose, record, token, onStatusUpdated }) {
    const [assignedAssetId, setAssignedAssetId] = useState("");
    const [loading, setLoading] = useState(false);
    const isAdmin = !!token;

    const handleMarkAssigned = async () => {
        if (!token) return;
        setLoading(true);
        try {
            await updateRequestStatus(token, record.requestId, {
                status: "ASSIGNED",
                assignedAssetId: assignedAssetId.trim() || null,
            });
            Toastify({ text: "Request marked as Assigned", className: "success-toast" }).showToast();
            onStatusUpdated?.();
        } catch (e) {
            Toastify({ text: e?.message || "Failed to update status", className: "error-toast", style: { background: "#dc2626" } }).showToast();
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!token) return;
        setLoading(true);
        try {
            await updateRequestStatus(token, record.requestId, { status: "REJECTED" });
            Toastify({ text: "Request rejected", className: "success-toast" }).showToast();
            onStatusUpdated?.();
        } catch (e) {
            Toastify({ text: e?.message || "Failed to reject", className: "error-toast", style: { background: "#dc2626" } }).showToast();
        } finally {
            setLoading(false);
        }
    };

    const handleApproveAndCreateAsset = async () => {
        if (!token) return;
        setLoading(true);
        try {
            await approveAndCreateAsset(token, record.requestId);
            Toastify({ text: "Asset created on blockchain and request marked as Assigned", className: "success-toast" }).showToast();
            onStatusUpdated?.();
        } catch (e) {
            Toastify({ text: e?.message || "Failed to create asset on blockchain", className: "error-toast", style: { background: "#dc2626" } }).showToast();
        } finally {
            setLoading(false);
        }
    };

    if (!record) return null;
    return (
        <>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}></div>
            <div
                id="popup-modal"
                tabIndex="-1"
                className="fixed inset-0 flex items-center justify-center z-50 overflow-y-hidden"
            >
                <div className="relative p-4 w-[700px] h-[95%]">
                    <div className="relative bg-white rounded-lg shadow h-full flex flex-col">
                        <button
                            onClick={onClose}
                            type="button"
                            className="absolute top-3 right-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                        >
                            <svg
                                className="w-3 h-3"
                                aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 14 14"
                            >
                                <path
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M1 1l6 6m0 0 6 6M7 7l6-6M7 7L1 13"
                                />
                            </svg>
                            <span className="sr-only">Close modal</span>
                        </button>
                        <div className="p-4 md:p-5 flex-grow custom-scroll no-scrollbar overflow-y-auto">
                            <div className="flex gap-3">
                                <div>
                                    <span className="font-semibold text-lg leading-loose">
                                        View Asset Request
                                    </span>
                                    <h3 className="mb-5 text-sm font-normal text-gray-500 dark:text-gray-400">
                                        View detail asset request to make easy considered
                                    </h3>
                                </div>
                            </div>
                            <hr/>
                            <div className="flex gap-3 mt-5 mb-5 rounded-md items-center">
                                <img
                                    src={record.profileImg || "https://via.placeholder.com/150"}
                                    alt={record.title}
                                    className="w-16 h-16 rounded-full object-cover"
                                />
                                <div>
                                    <h1 className="text-[16px] font-semibold">{record.fullName || "User Name"}</h1>
                                    <p className="text-xs font-medium text-[#7f7f7f]">{record.email || "user@example.com"}</p>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label
                                    htmlFor="asset_name"
                                    className="block mb-2 text-sm font-medium text-[#344054]"
                                >
                                    Asset Name
                                </label>
                                <input
                                    type="text"
                                    id="asset_name"
                                    className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 placeholder:text-[#B8BCCA] dark:text-white border-none focus:border-none focus:ring-0"
                                    placeholder="Asset Name"
                                    value={record.assetName || ""}
                                    readOnly
                                />
                            </div>

                            <div className="mb-3">
                                <label
                                    htmlFor="asset_name"
                                    className="block mb-2 text-sm font-medium text-[#344054]"
                                >
                                    Qty
                                </label>
                                <input
                                    type="text"
                                    id="asset_name"
                                    className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 placeholder:text-[#B8BCCA] dark:text-white border-none focus:border-none focus:ring-0"
                                    placeholder="Asset Name"
                                    value={record.qty || ""}
                                    readOnly
                                />
                            </div>

                            <div className="mb-3">
                                <label
                                    htmlFor="asset_name"
                                    className="block mb-2 text-sm font-medium text-[#344054]"
                                >
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    id="asset_name"
                                    className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 placeholder:text-[#B8BCCA] dark:text-white border-none focus:border-none focus:ring-0"
                                    placeholder="Asset Name"
                                    value={record.unit || ""}
                                    readOnly
                                />
                            </div>
                            <div className="mb-3">
                                <label
                                    htmlFor="problem"
                                    className="block mb-2 text-sm font-medium text-[#344054]"
                                >
                                    reason
                                </label>
                                <textarea
                                    id="problem"
                                    rows="4"
                                    className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 placeholder:text-[#B8BCCA] dark:text-white border-none focus:border-none focus:ring-0"
                                    placeholder="Describe the issue"
                                    value={record.reason || ""}
                                    readOnly
                                ></textarea>
                            </div>
                            <div className="mb-3">
                                <label className="block mb-2 text-sm font-medium text-[#344054]">Status</label>
                                <span
                                    className="inline-block px-2 py-1 rounded text-sm font-semibold"
                                    style={{
                                        color: (record.status || "PENDING") === "ASSIGNED" ? "#14AE5C" : (record.status || "PENDING") === "REJECTED" ? "#EC221F" : "#F59E0B",
                                        background: (record.status || "PENDING") === "ASSIGNED" ? "#d1fae5" : (record.status || "PENDING") === "REJECTED" ? "#fee2e2" : "#fef3c7",
                                    }}
                                >
                                    {(record.status || "PENDING") === "ASSIGNED" ? "Assigned" : (record.status || "PENDING") === "REJECTED" ? "Rejected" : "Pending"}
                                </span>
                                {record.assignedAssetId && (
                                    <span className="ml-2 text-xs text-gray-500">Asset ID: {record.assignedAssetId}</span>
                                )}
                                {isAdmin && (record.status || "PENDING") === "ASSIGNED" && record.assignedAssetId && (
                                    <div className="mt-2">
                                        <Link
                                            href={`/admin/asset/show/${encodeURIComponent(record.assignedAssetId)}`}
                                            className="text-sm font-medium text-[#4B68FF] hover:underline"
                                            onClick={() => onClose?.()}
                                        >
                                            View this asset in Asset section →
                                        </Link>
                                    </div>
                                )}
                            </div>
                            <div className="mb-10">
                                <label
                                    htmlFor="attachment"
                                    className="block mb-2 text-sm font-medium text-[#344054]"
                                >
                                    Attachment
                                </label>
                                <img
                                    src={record.attachment || "https://via.placeholder.com/500"}
                                    alt="Attachment"
                                    className="rounded-md w-full"
                                />
                            </div>
                            {isAdmin && (record.status || "PENDING") === "PENDING" && (
                                <div className="flex flex-col gap-3 pt-2 border-t">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleApproveAndCreateAsset}
                                            disabled={loading}
                                            className="px-4 py-2 rounded-lg text-white font-medium bg-[#4B68FF] hover:bg-[#3b58ef] disabled:opacity-50"
                                        >
                                            {loading ? "..." : "Approve & Create Asset (blockchain)"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleReject}
                                            disabled={loading}
                                            className="px-4 py-2 rounded-lg text-white font-medium bg-[#EC221F] hover:bg-[#c41c19] disabled:opacity-50"
                                        >
                                            {loading ? "..." : "Reject"}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">For the user to see the asset in <strong>User → Asset</strong>, use &quot;Approve & Create Asset (blockchain)&quot; above. Or mark as assigned only (status in DB; no new asset on chain):</p>
                                    <input
                                        type="text"
                                        placeholder="e.g. AST-xxx (optional)"
                                        className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 border"
                                        value={assignedAssetId}
                                        onChange={(e) => setAssignedAssetId(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleMarkAssigned}
                                        disabled={loading}
                                        className="px-4 py-2 rounded-lg text-white font-medium bg-[#14AE5C] hover:bg-[#0d8a47] disabled:opacity-50 w-fit"
                                    >
                                        {loading ? "..." : "Mark as Assigned only"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
