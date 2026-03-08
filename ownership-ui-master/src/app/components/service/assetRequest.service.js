import { reqHeader } from "../../utils/header.config";
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

export const getAllAssetRequest = async (token) => {
    const header = await reqHeader(token);
    try {

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/assetRequest`, {
            headers: header,
            cache: "no-store",
            next: { revalidate: 10, tag: ["getAllAssetRequest"] },
        });
        const data = await res.json();
        console.log(data)
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error in getAllAssetRequest:", error);
        return [];
    }
};




export const userGetAllRequest = async (token) => {
    const header = await reqHeader(token);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/assetRequest`, {
            method: "GET",
            headers: header,
            cache: "no-store",
            next: { tag: ["userGetAllRequest"] },
        });
        const { payload } = await res.json();
        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.error("Error in getAllAssetRequest:", error);
        return [];
    }
}


export const updateRequest = async (token, data, requestId) => {
    const header = await reqHeader(token);
    const updateAssetRequest = {
        assetName: data?.assetName,
        qty: data?.qty,
        unit: data?.unit,
        reason: data?.reason,
        createdAt: data?.createdAt,
        attachment: data?.attachment
    };
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/updateAssetRequest/${requestId}`, {
        method: "PUT",
        headers: header,
        body: JSON.stringify(updateAssetRequest),
        next: { tag: ["updateAssetRequest"] },
    });
    console.log("res", res)
    const { payload } = await res.json();
    console.log(payload)
    return (payload) ? payload : "";
}


export const deleteRequest = async (token, requestId) => {
    const header = await reqHeader(token);
    console.log("id", requestId)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/deleteAssetRequest/${requestId}`, {
        method: "DELETE",
        headers: header,
        next: { tag: ["deleteRequest"] },
    });

    console.log("res", res)
    const { payload } = await res.json();
    if (payload === true) {
        Toastify({
            text: "Delete asset request success",
            className: "success-toast",
        }).showToast();
    }
    console.log(payload)
    return payload;
}


export const createRequest = async (token,data) => {
    const header = await reqHeader(token);
    const { assetName, qty, unit, reason, attachment } = data;
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/createAssetRequest`,
        {
            method: "POST",
            headers: header,
            body: JSON.stringify({
                assetName,
                qty,
                unit,
                reason,
                attachment,
            }),
        },
        {
            next: { tag: ["createRequest"] },
        }
    );
    console.log("raw",res)
    const {payload} = await res.json();
    return payload;
}

/** Admin: approve request by creating asset on blockchain (assign to requester) and marking request ASSIGNED. */
export const approveAndCreateAsset = async (token, requestId) => {
    const header = await reqHeader(token);
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/assetRequest/${requestId}/approveAndCreateAsset`,
        { method: "POST", headers: header }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed to approve and create asset: ${res.status}`);
    }
    const { payload } = await res.json();
    return payload;
};

/** Admin: set request status to ASSIGNED or REJECTED. assignedAssetId optional when status is ASSIGNED. */
export const updateRequestStatus = async (token, requestId, { status, assignedAssetId }) => {
    const header = await reqHeader(token);
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/assetRequest/${requestId}/status`,
        {
            method: "PUT",
            headers: header,
            body: JSON.stringify({ status, assignedAssetId: assignedAssetId || null }),
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed to update status: ${res.status}`);
    }
    const { payload } = await res.json();
    return payload;
}