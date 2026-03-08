import React, { useEffect, useState } from 'react'
import Transfer from "../app-icon/transfer.svg"
import Image from 'next/image'
import { getAllUser } from '../service/user.service'
import { useSession } from 'next-auth/react';
import { transferAsset } from '../service/asset.service';
import Loading from './Loading';
export default function TransferAssetPopup({ onClose, assetId, currentOwnerId, onTransferSuccess }) {
    // const { id } = useParams();
    const { data: session } = useSession();
    const token = session?.accessToken;
    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState(null); 
    const [loading, setLoading] = useState()
    const handleUserClick = (userId) => {
        setSelectedUser(userId); 
    };

    const fetchUser = async () => {
        const allUser = await getAllUser(token)
        setUsers(allUser)
    }

    useEffect(() => {
        fetchUser();
    }, [token]);

    const availableUsers = users.filter(
        (user) => String(user.userId) !== String(currentOwnerId)
    );

    const handleTransfer = async () => {
       setLoading(true)
       try{
        const updatedData = {
            newAssignTo: selectedUser
        }
        const transfer = await transferAsset(token,updatedData,assetId)
        console.log("transfer", transfer)
        if (transfer === true) {
          onTransferSuccess?.()
        }
       }catch (error) {
        console.error("Failed to transfer asset:", error);
      } finally {
        setLoading(false)
      }
      onClose()
    }
    


    return (
        <>
            {/* overlay */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}></div>
            {/* center */}
            <div id="popup-modal" tabIndex="-1" className="fixed inset-0 flex items-center justify-center z-50">
            {loading ? (
          <Loading />
        ) : (
                <div class="relative p-4 w-full max-w-md max-h-full">
                    <div class="relative bg-white rounded-lg shadow dark:bg-gray-700">
                        <button onClick={onClose} type="button" class="absolute top-3 end-2.5 text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white">
                            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" />
                            </svg>
                            <span class="sr-only">Close modal</span>
                        </button>
                        <div class="p-4 md:p-5">
                            <div className='flex gap-3'>
                                <Image src={Transfer} />
                                <div>
                                    <span className='font-semibold text-sm'>Tranfer Asset</span>
                                    <h3 class="mb-5 text-sm font-normal text-gray-500 dark:text-gray-400">Are you sure you want to transfer this asset?</h3>
                                </div>
                            </div>

                            <div>
                                <form>
                                    <div class="flex mt-6">
                                        <div class="relative w-full">
                                            <input type="search" id="search-dropdown" class="block p-2.5 w-full z-20 text-sm text-gray-900 bg-gray-50 rounded-lg rounded-s-gray-100 rounded-s-2 dark:placeholder-gray-400 dark:text-white placeholder:pl-3" placeholder="Search..." required />
                                            <button type="submit" class="absolute top-0 end-0 p-2.5 h-full text-sm font-medium text-white rounded-e-lg  border-l-0"><svg class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                                                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" className='text-[#4B68FF]' />
                                            </svg></button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className='mb-10 mt-7'>
                                <div
                                    className="flex flex-col gap-3 overflow-y-auto h-96"
                                    style={{ maxWidth: "100%" }}
                                >
                                    {availableUsers.map((user) => (
                                        <div 
                                        key={user.userId}
                                            className={`flex gap-3 mb-1 rounded-md p-4 cursor-pointer ${
                                                selectedUser === user.userId ? "bg-red-500 text-white" : "hover:bg-[#f9fafb]"
                                            }`}
                                            onClick={() => handleUserClick(user.userId)}
                                        >
                                            <img src={user ? user.profileImg : "https://plus.unsplash.com/premium_photo-1690407617542-2f210cf20d7e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mjl8fHByb2ZpbGV8ZW58MHx8MHx8fDA%3D"} alt="" className='w-10 h-10 rounded-full object-cover' />
                                            <div>
                                                <h1 className='text-[15px]'>{user ? user.fullName : "N/A"}</h1>
                                                <p className='text-xs'>{user ? user.department.dep_name : "N/A"}</p>
                                            </div>
                                        </div>
                                    ))}


                                    {/* <div className='flex gap-3 mb-1 hover:bg-[#f9fafb] rounded-md p-4'>
                                    <img src="https://plus.unsplash.com/premium_photo-1690407617542-2f210cf20d7e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mjl8fHByb2ZpbGV8ZW58MHx8MHx8fDA%3D" alt="" className='w-10 h-10 rounded-full object-cover' />
                                    <div>
                                        <h1 className='text-[15px]'>David helio</h1>
                                        <p className='text-xs'>UX/UI design</p>
                                    </div>
                                </div> */}
                                </div>
                            </div>

                            <div className='flex justify-end'>
                                <button onClick={onClose} type="button" class="text-[#344054] bg-white font-semibold border-[1px]  focus:ring-4 focus:ring-red-300  rounded-lg text-sm inline-flex items-center px-5 py-2.5 text-center">
                                    Cancel
                                </button>
                                <button disabled={loading || !selectedUser} onClick={handleTransfer} type="button" class="py-2.5 px-5 ms-3 text-sm font-semibold text-white focus:outline-none bg-[#14AE5C] rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400">Transfer</button>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>

        </>
    )
}
