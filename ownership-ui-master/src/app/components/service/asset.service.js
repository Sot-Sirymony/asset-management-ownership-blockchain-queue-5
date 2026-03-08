import { reqHeader } from "../../utils/header.config";
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

export const getAllAsset = async (token) => {
    const header = await reqHeader(token);
    try {

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/getAllAsset`, {
            headers: header,
            cache: "no-store",
            next: { tag: ["getAllAsset"] },
        });
        console.log("res", res)
        const {payload} = await res.json();
        console.log("data",payload)
        return Array.isArray(payload) ? payload : [];
    } catch (error) {
        console.error("Error in getAllAsset:", error);
        return [];
    }
};


export const createAsset = async (token, data) => {
    const header = await reqHeader(token);
    const { assetName, qty, unit, condition, attachment, assignTo } = data;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/createAsset`, {
        method: "POST",
        headers: header,
        body: JSON.stringify({
            assetName,
            qty,
            unit,
            condition,
            attachment,
            assignTo: assignTo != null ? Number(assignTo) : undefined,
        }),
    }, { next: { tag: ["createAsset"] } });
    const text = await res.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        payload = {};
    }
    if (!res.ok) {
        let msg = payload?.detail || payload?.message;
        if (!msg && typeof payload === 'object' && Object.keys(payload).length > 0)
            msg = Object.values(payload)[0] || Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join(', ');
        throw new Error(msg || `Create asset failed (${res.status})`);
    }
    Toastify({
        text: "Create asset successful!",
        className: "success-toast",
    }).showToast();
    return payload;
};

export const getAsset = async (token,assetId) => {
    const header = await reqHeader(token);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/getAsset/${assetId}`, {
            method: "GET",
            headers: header,
            next: { tag: ["getAsset"] },
        });
        console.log("res", res)
        const {payload} = await res.json();
        console.log("data",payload)
        return payload;
    } catch (error) {
        console.error("Error in getAsset:", error);
        return [];
    }
};


export const updateAsset = async (token, data, assetId) => {
    const header = await reqHeader(token);
    console.log("assetId", assetId)
    const updateAsset = {
        assetName: data?.assetName,
        qty: data?.qty,
        unit: data?.unit,
        condition: data?.condition,
        attachment: data?.attachment,
        assignTo: data?.assignTo
    };
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/updateAsset/${assetId}`,
        {
            method: "PUT",
            headers: header,
            cache: "no-store",
            body: JSON.stringify(updateAsset),
        },
        {
            next: {
                tag: ["updateAsset"],
            },
        }
    );

    console.log("Raw response:", res);

    // Read the response body
    const {payload} = await res.json();
    console.log("Payload:", payload);

    return payload;
}

export const transferAsset = async (token,data, assetId) => {
    const header = await reqHeader(token);
    console.log("assetId", assetId)
    const updateTransfer = {
        newAssignTo: data?.newAssignTo,
    };
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/transferAsset/${assetId}`,
        {
            method: "PUT",
            headers: header,
            body: JSON.stringify(updateTransfer),
        },
        {
            next: {
                tag: ["updateTransfer"],
            },
        }
    );

    console.log("Raw response:", res);

    const response = await res.json();
    console.log("Payload:", response.payload);
    if(response.payload == true){
        Toastify({
            text: "Transfer user success!!!",
            className: "success-toast",
        }).showToast();
    }
    return response.payload;
}


export const deleteAsset = async (token, assetId) => {
    const header = await reqHeader(token);
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/user/deleteAsset/${assetId}`,
        {
            method: "DELETE",
            headers: header,
        },
        {
            next: {
                tag: ["deleteAsset"],
            },
        }
    );
    console.log("Raw response:", res);
    if(res.status === 200){
        Toastify({
            text: "Delete asset successfully!!!",
            className: "success-toast",
        }).showToast();
    }
    const response = await res.json();
    console.log("Payload:", response.payload);

    return response.payload;
}