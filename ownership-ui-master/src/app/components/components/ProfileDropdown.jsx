"use client";

import { Avatar, Button, Dropdown, Space, Spin } from "antd";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getOwnProfile, getUserById } from "../action/UserAction";

export default function ProfileDropdown() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const token = session?.accessToken
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const userDetails = await getOwnProfile(token);
      console.log("userdetail", userDetails)
      setUser(userDetails);
    } catch (error) {
      console.error("Error fetching user details:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const menuItems = [
    {
      key: "1",
      label: (
        <button className="px-4 py-2" onClick={() => {
          (role == "ADMIN") ? router.push(`/admin/profile/show/${userId}`) : router.push(`/user/profile/show/${userId}`)
        }}>
          <Space >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18 10C18 12.1217 17.1571 14.1566 15.6569 15.6569C14.1566 17.1571 12.1217 18 10 18C7.87827 18 5.84344 17.1571 4.34315 15.6569C2.84285 14.1566 2 12.1217 2 10C2 7.87827 2.84285 5.84344 4.34315 4.34315C5.84344 2.84285 7.87827 2 10 2C12.1217 2 14.1566 2.84285 15.6569 4.34315C17.1571 5.84344 18 7.87827 18 10ZM12 7C12 7.53043 11.7893 8.03914 11.4142 8.41421C11.0391 8.78929 10.5304 9 10 9C9.46957 9 8.96086 8.78929 8.58579 8.41421C8.21071 8.03914 8 7.53043 8 7C8 6.46957 8.21071 5.96086 8.58579 5.58579C8.96086 5.21071 9.46957 5 10 5C10.5304 5 11.0391 5.21071 11.4142 5.58579C11.7893 5.96086 12 6.46957 12 7ZM10 11C9.0426 10.9998 8.10528 11.2745 7.29942 11.7914C6.49356 12.3083 5.85304 13.0457 5.454 13.916C6.01668 14.5706 6.71427 15.0958 7.49894 15.4555C8.28362 15.8152 9.13681 16.0009 10 16C10.8632 16.0009 11.7164 15.8152 12.5011 15.4555C13.2857 15.0958 13.9833 14.5706 14.546 13.916C14.147 13.0457 13.5064 12.3083 12.7006 11.7914C11.8947 11.2745 10.9574 10.9998 10 11Z"
                fill="#90A4AE"
              />
            </svg>
            My Profile
          </Space>
        </button>
      ),
    },
    {
      key: "2",
      label: (
        <button type="button" className="py-2 px-4" onClick={handleLogout} aria-label="Sign Out" data-testid="sign-out-button">
          <Space>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 3C2.73478 3 2.48043 3.10536 2.29289 3.29289C2.10536 3.48043 2 3.73478 2 4V16C2 16.2652 2.10536 16.5196 2.29289 16.7071C2.48043 16.8946 2.73478 17 3 17C3.26522 17 3.51957 16.8946 3.70711 16.7071C3.89464 16.5196 4 16.2652 4 16V4C4 3.73478 3.89464 3.48043 3.70711 3.29289C3.51957 3.10536 3.26522 3 3 3ZM13.293 12.293C13.1108 12.4816 13.01 12.7342 13.0123 12.9964C13.0146 13.2586 13.1198 13.5094 13.3052 13.6948C13.4906 13.8802 13.7414 13.9854 14.0036 13.9877C14.2658 13.99 14.5184 13.8892 14.707 13.707L17.707 10.707C17.8945 10.5195 17.9998 10.2652 17.9998 10C17.9998 9.73484 17.8945 9.48053 17.707 9.293L14.707 6.293C14.6148 6.19749 14.5044 6.12131 14.3824 6.0689C14.2604 6.01649 14.1292 5.9889 13.9964 5.98775C13.8636 5.9866 13.7319 6.0119 13.609 6.06218C13.4861 6.11246 13.3745 6.18671 13.2806 6.2806C13.1867 6.3745 13.1125 6.48615 13.0622 6.60905C13.0119 6.73194 12.9866 6.86362 12.9877 6.9964C12.9889 7.12918 13.0165 7.2604 13.0689 7.3824C13.1213 7.50441 13.1975 7.61475 13.293 7.707L14.586 9H7C6.73478 9 6.48043 9.10536 6.29289 9.29289C6.10536 9.48043 6 9.73478 6 10C6 10.2652 6.10536 10.5196 6.29289 10.7071C6.48043 10.8946 6.73478 11 7 11H14.586L13.293 12.293Z"
                fill="#90A4AE"
              />
            </svg>
            Sign Out

          </Space>
        </button>
      ),
    },
  ];
  if (status === "loading") {
    return <div>Loading...</div>;
  }
  return (
    <div className="flex gap-3">
      <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
        <Button type="link" aria-label="Open profile menu">
          <Space>
            <Avatar src={user?.profileImg || "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=500"} />
          </Space>
        </Button>
      </Dropdown>
      <div>
        <h1 className="avartar-name">{user?.fullName || "N/A"}</h1>
        <h1 className="avartar-name">{role ? role.toLowerCase() : "N/A"}</h1>
      </div>
    </div>
  );
}
