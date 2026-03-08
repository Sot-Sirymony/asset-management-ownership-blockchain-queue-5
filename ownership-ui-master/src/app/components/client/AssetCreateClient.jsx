"use client";

import { UploadOutlined } from "@ant-design/icons";
import { Create } from "@refinedev/antd";
import { Form, Input, Select, Upload } from "antd";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAllUser } from "../service/user.service";
import { useSession } from "next-auth/react";
import { uploadImages } from "../service/file.service";
import { addAsset } from "../action/AssetAction";
import Loading from "../components/Loading";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

export default function CategoryCreateClient() {
    const router = useRouter();
    const { data: session } = useSession();
    const token = session?.accessToken;
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImage, setPreviewImage] = useState("");
    const [fileList, setFileList] = useState([]);
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false);

    const handlePreview = async (file) => {
        setPreviewImage(file.url || file.preview);
        setPreviewVisible(true);
    };

    const handleChange = ({ fileList }) => setFileList(fileList);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            let attachmentUrl = null;
            const file = fileList[0]?.originFileObj;
            if (file) {
                const formData = new FormData();
                formData.append("file", file);
                Object.keys(values).forEach((key) => {
                    formData.append(key, values[key]);
                });
                const res = await uploadImages(formData);
                if (res?.payload?.fileUrl) {
                    attachmentUrl = res.payload.fileUrl;
                }
            }
            const newAsset = {
                assetName: values.assetName,
                qty: values.qty,
                unit: values.unit,
                condition: values.condition,
                attachment: attachmentUrl,
                assignTo: values.assignTo != null ? Number(values.assignTo) : undefined,
            };
            await addAsset(token, newAsset);
            router.push("/admin/asset");
        } catch (error) {
            console.error("Error saving asset:", error);
            let message = error?.message || "Failed to create asset.";
            if (message.includes("orderer") || message.includes("send transaction") || message.includes("transaction to the orderer")) {
                message = "Blockchain orderer unreachable. Start the network (e.g. ./start-all-projects.sh), ensure FABRIC_ORDERER_URL is set, then restart the API on port 8081.";
            }
            Toastify({
                text: message,
                className: "error-toast",
                style: { background: "#dc2626", maxWidth: "380px" },
            }).showToast();
        } finally {
            setLoading(false);
        }
    };

    const fetchUser = async () => {
        const allUser = await getAllUser(token)
        console.log("allUser", allUser)
        setUsers(allUser)
    }

    useEffect(() => {
        fetchUser();
    }, [token]);

    return (
        <section className={"p-5 pt-0"}>
            {loading ? (
          <Loading />
        ) : (
            <Form layout="vertical" onFinish={onFinish}>
                <Create title={""}>
                    <div className="mb-5 leading-loose">
                        <h1 className="text-2xl font-semibold text-[#151D48]">Assign Asset</h1>
                        <p className="text-[#6F6C90]">Assign asset or digital asset to your user</p>
                    </div>
                    <hr className="border-[#3D7EDF] opacity-[30%]" />
                    <div className="flex gap-10 mt-5">
                        <div className="flex-1">
                            <Form.Item
                                label={<span style={{ color: "#344054" }}>Asset Name</span>}
                                name="assetName"
                                rules={[{ required: true, message: "Please enter an asset name" }]}
                            >
                                <Input placeholder="Enter asset name" />
                            </Form.Item>

                            <Form.Item
                                label={<span style={{ color: "#344054" }}>Qty</span>}
                                name="qty"
                                rules={[{
                                    required: true, 
                                    message: "Please enter quantity",
                                }, {
                                    pattern: /^[+]?\d*\.?\d+$/,
                                    message: "Please enter a positive number",
                                }, {
                                    validator: (_, value) => {
                                        if (value <= 0) {
                                            return Promise.reject(new Error('Quantity must be a positive number'));
                                        }
                                        return Promise.resolve();
                                    }
                                }]}
                            >
                                <Input
                                    placeholder="Enter quantity"
                                    type="number"
                                />
                            </Form.Item>

                            <Form.Item label="Unit" name="unit"
                            rules={[{
                                required: true,
                                message: "Please input unit"
                            }]}
                            >
                                <Input placeholder="Enter unit" />
                            </Form.Item>

                            <Form.Item
                                label={<span style={{ color: "#344054" }}>Assign To</span>}
                                name="assignTo"
                                rules={[{
                                    required: true,
                                    message: "Please select assign to"
                                }]}
                            >
                                <Select placeholder="Select a user">
                                    {users.map((user) => (
                                        <Select.Option
                                            key={user.userId}
                                            onClick={() => console.log("userId", user.userId)}
                                            value={user.userId}
                                        >
                                            {user.fullName}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                label={<span style={{ color: "#344054" }}>Condition</span>}
                                name="condition"
                                rules={[{
                                    required: true,
                                    message: "Please select condition"
                                }]}
                            >
                                <Select placeholder="Select condition">
                                    <Select.Option value="Good">Good</Select.Option>
                                    <Select.Option value="Medium">Medium</Select.Option>
                                    <Select.Option value="Low">Low</Select.Option>
                                </Select>
                            </Form.Item>
                        </div>

                        <div className="flex-1">
                            {/* <Form.Item
                                label={<span style={{ color: "#344054" }}>Description</span>}
                                name="description"
                            >
                                <Input.TextArea placeholder="Enter description" rows={5} />
                            </Form.Item> */}

                            <Form.Item
                                label={<span style={{ color: "#344054" }}>Attachment (optional)</span>}
                                name="attachment"
                            >
                                <Upload.Dragger
                                    name="files"
                                    listType="picture-card"
                                    fileList={fileList}
                                    onPreview={handlePreview}
                                    onChange={({ fileList }) => {
                                        setFileList(fileList.slice(-1));
                                    }}
                                    maxCount={1}
                                    beforeUpload={() => false}
                                    className="flex flex-col justify-center items-center"
                                >
                                    {fileList.length > 0 ? (
                                        <Image
                                            src={fileList[0].url || URL.createObjectURL(fileList[0].originFileObj)}
                                            alt="uploaded"
                                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                            width={100}
                                            height={100}
                                        />
                                    ) : (
                                        <>
                                            <p className="ant-upload-drag-icon">
                                                <UploadOutlined />
                                            </p>
                                            <p className="ant-upload-text">Click or drag file to this area to upload</p>
                                        </>
                                    )}
                                </Upload.Dragger>
                            </Form.Item>
                        </div>
                    </div>
                    <div className="flex justify-end p-4">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/asset")}
                            className="text-[#344054] bg-white font-semibold border-[1px] focus:ring-4 focus:ring-red-300 rounded-lg text-sm inline-flex items-center px-12 py-2.5 text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="py-2.5 px-12 ms-3 text-sm font-semibold text-white focus:outline-none bg-[#4B68FF] rounded-lg border border-gray-200 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        >
                            Save
                        </button>
                    </div>
                </Create>
            </Form>
        )}
        </section>
    );
}
