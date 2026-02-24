import React from 'react';
import { AppIcon } from '../app-icon';
import { useRouter } from 'next/navigation';
import { signIn, getSession, useSession } from 'next-auth/react';
import { authInfoGlobal } from '../store/authentication';
import { useForm } from 'react-hook-form';
import { loginService } from '../service/auth.service';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
export default function LoginPopup({ onClose }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const role = session?.user?.role;
    const setUsername = authInfoGlobal((state) => state.setUsername);

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm({
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const onSubmit = async (data) => {
        try {
                const result = await signIn("credentials", {
                    username: data.username,
                    password: data.password,
                    redirect: false,
                });

                if (result?.ok) {
                    Toastify({
                        text: "Login successfully!!!",
                        className: "success-toast",
                    }).showToast();
                    setUsername(data.username);
                    const updatedSession = await getSession();
                    const userRole = updatedSession?.user?.role;
                    onClose();
                    if (userRole === "ADMIN") {
                        router.replace("/admin/dashboard");
                    } else {
                        router.replace("/user/asset");
                    }
                    router.refresh();
                } else {
                    setError('root', {
                        type: 'manual',
                        message: 'Invalid credentials'
                    });
                }
        } catch (error) {
            console.error('Login error:', error);
            setError('root', {
                type: 'manual',
                message: error.message || 'An error occurred during login'
            });
        }
    };

    return (
        <>
            {/* overlay + modal: overlay closes on outside click; inner content stops propagation */}
            <div
                id="popup-modal"
                role="dialog"
                aria-modal="true"
                tabIndex="-1"
                className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
                onClick={onClose}
            >
                <div
                    className="relative p-4 w-full max-w-md max-h-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
                        <button
                            onClick={onClose}
                            type="button"
                            className="absolute top-3 end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                        >
                            <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                            </svg>
                            <span className="sr-only">Close modal</span>
                        </button>

                        <div className="p-4 md:p-5">
                            <div className="flex gap-3 items-center">
                                <AppIcon />
                                <div>
                                    <span style={{ color: "#151D48", fontWeight: 'bold' }}>OWNER</span>
                                    <span style={{
                                        color: "#4B68FF",
                                        fontWeight: 'bold',
                                        width: "100px"
                                    }}>SHIP</span>
                                </div>
                            </div>

                            <h1 className="text-xl font-bold mt-3 mb-3">Login to your account</h1>

                            <form onSubmit={handleSubmit(onSubmit)} noValidate>
                                <div className="mb-3 mt-3">
                                    <label htmlFor="username" className="block mb-2 text-sm font-medium text-[#344054]">Username</label>
                                    <input
                                        type="text"
                                        id="username"
                                        {...register("username", { 
                                            required: "Username is required" 
                                        })}
                                        className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 placeholder:text-[#B8BCCA] dark:text-white border-none focus:border-none focus:ring-0"
                                        placeholder="Enter your username"
                                    />
                                    {errors.username && (
                                        <span className="text-red-500 text-sm">{errors.username.message}</span>
                                    )}
                                </div>

                                <div className="mb-3 mt-3">
                                    <label htmlFor="password" className="block mb-2 text-sm font-medium text-[#344054]">Password</label>
                                    <input
                                        type="password"
                                        id="password"
                                        {...register("password", { 
                                            required: "Password is required" 
                                        })}
                                        className="bg-[#F8FAFC] text-gray-900 text-sm rounded-lg block w-full p-2.5 placeholder:text-[#B8BCCA] dark:text-white border-none focus:border-none focus:ring-0"
                                        placeholder="Enter your password"
                                    />
                                    {errors.password && (
                                        <span className="text-red-500 text-sm">{errors.password.message}</span>
                                    )}
                                </div>

                                {errors.root && (
                                    <p id="login-root-error" className="text-red-500 text-sm mt-2" role="alert">{errors.root.message}</p>
                                )}

                                <div className="flex mt-5">
                                    <button
                                        type="submit"
                                        className="text-white bg-[#bcbcbc] hover:bg-[#4b68ff] font-semibold border-[1px] rounded-lg text-sm inline-flex items-center w-full py-2.5 text-center justify-center"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Logging in...' : 'Login'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}