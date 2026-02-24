"use client";

import { useEffect } from 'react';
import { useState } from "react";
import { AppIcon } from "./components/app-icon";
import LoginPopup from "./components/components/LoginPopup";
import Illustration from "./components/app-icon/Illustration.svg"
import MultipleAsset from "./components/app-icon/multipleAsset.svg"
import Decentrailize from "./components/app-icon/decentrailize.svg"
import RealTime from "./components/app-icon/realTime.svg"
import UserFriendly from "./components/app-icon/userFriendly.svg"
import PowerAsset from "./components/app-icon/powerAsset.svg"
import Image from "next/image";
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function IndexPage() {
  const router = useRouter();
  useEffect(() => {
    AOS.init({
      duration: 1000, 
      once: true,
    });
    AOS.refresh();
  }, []);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const { data: session, status } = useSession();
  // When logged in, visiting home redirects to app so "home shows user state"
  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) {
      const role = session.user.role;
      if (role === "ADMIN") router.replace("/admin/dashboard");
      else router.replace("/user/asset");
    }
  }, [session, status, router]);
  const handleLoginClick = () => {
    if (session?.user) {
      const role = session.user.role;
      if (role === "ADMIN") router.replace("/admin/dashboard");
      else router.replace("/user/asset");
    } else {
      setIsLoginVisible(true);
    }
  };
  const closeLogin = () => {
    setIsLoginVisible(false);
  };

  return (
    <>
      <nav className="mx-auto bg-white border-gray-200 dark:bg-gray-900 max-w-[1024px]">
        <div className="max-w-screen-xl flex items-center justify-between mx-auto py-4">
          {/* Logo and Title Section */}
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <AppIcon />
            <div>
              <span style={{ color: "#151D48", fontWeight: 'bold' }}>OWNER</span>
              <span style={{ color: "#4B68FF", fontWeight: 'bold', width: "100px" }}>SHIP</span>
            </div>
          </div>

          {/* Menu and Login Button Section */}
          <div className="flex items-center space-x-4 md:space-x-8 rtl:space-x-reverse">
            {/* Navigation Links */}
            <ul className="hidden mb-0 md:flex flex-row font-medium space-x-4 rtl:space-x-reverse md:space-x-8">
              <li>
                <a href="#feature" className="text-[#4b68ff] font-bold dark:text-blue-500 hover:text-blue-800">
                  Feature
                </a>
              </li>
              <li>
                <a href="#about-us"
                  className="text-[#273240] font-bold dark:text-white hover:text-blue-700 dark:hover:text-blue-500">
                  About us
                </a>
              </li>
            </ul>
            {/* Login Button */}
            <button
              onClick={handleLoginClick}
              type="button"
              className="font-bold px-10 py-3 text-white bg-[#4b68ff] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-md text-sm  text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Login
            </button>
            {/* Mobile Menu Toggle */}
            <button
              data-collapse-toggle="navbar-cta"
              type="button"
              className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
              aria-controls="navbar-cta"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="w-5 h-5"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 17 14"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M1 1h15M1 7h15M1 13h15"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={"bg-gray-50"}>
        <div id="about-us"
          className="flex items-center justify-between max-w-[1024px] mx-auto py-16 my-auto">
          <div className="max-w-lg text-left">
            <h1 className="text-4xl font-semibold text-gray-800 leading-[1.5]">
              <span className="text-blue-600">Ownership</span> offers secure, transparent asset management for
              efficient operations.
            </h1>
          </div>

          <div className="hidden md:block">
            <Image src={Illustration} className="w-72 h-auto" alt="test" />
          </div>
        </div>
      </div>


      <div className="mt-10" id="feature">
        <div className="flex flex-col justify-center items-center">
          <h1 className="text-3xl text-[#4d4d4d] font-bold  leading-tight">
            Ownership featuring bring you
          </h1>
          <h1 className="text-3xl text-[#4d4d4d] font-bold  leading-tight">
            to digital management
          </h1>
          <p className="text-xs font-thin leading-relaxed text-[#8f8f8f]">
            Who is Ownership suitable for?
          </p>
        </div>
        <div className="flex justify-center items-center gap-5 mt-5" data-aos="fade-up-right" data-aos-duration="2500">
          <div className="max-w-96 w-72 h-48 border border-[#b7c8c87d] rounded-xl p-5 pb-7 hover:scale-105 duration-150 ease-in-out">
            <Image src={MultipleAsset} alt="" className="w-10 h-auto" />
            <h1 className="text-xl font-medium text-[#061c3d] mt-3">Multiple Asset Support</h1>
            <p className="text-xs font-thin text-[#687589]">Manage and transfer a wide range of assets
              including real estate, digital goods, intellectual
              property, and more.</p>
          </div>
          <div className="max-w-96 w-72 h-48 border border-[#b7c8c87d] rounded-xl p-5 pb-7 hover:scale-105 duration-150 ease-in-out">
            <Image src={Decentrailize} alt="" className="w-10 h-auto" />
            <h1 className="text-xl font-medium text-[#061c3d] mt-3">Decentralized Identity and
              Privacy Control</h1>
            <p className="text-xs font-thin text-[#687589]">Give users control over their personal data and
              ownership identity with decentralized identity
              features.</p>
          </div>
          <div className="max-w-96 w-72 h-48 border border-[#b7c8c87d] rounded-xl p-5 pb-7 shadow-xl  hover:scale-105 duration-150 ease-in-out ">
            <Image src={RealTime} alt="" className="w-10 h-auto" />
            <h1 className="text-xl font-medium text-[#061c3d] mt-3">Real-Time Verification</h1>
            <p className="text-xs font-thin text-[#687589]">Instantly verify the authenticity and ownership
              of any asset with blockchain-backed proof.</p>
          </div>
        </div>
        <div className="flex justify-center items-center gap-5 mt-10 " data-aos="fade-up-left" data-aos-duration="2500">
          <div className="max-w-96 w-72 h-48 border border-[#b7c8c87d] rounded-xl p-5 pb-7 shadow-xl hover:scale-105 duration-150 ease-in-out">
            <Image src={UserFriendly} alt="" className="w-10 h-auto " />
            <h1 className="text-xl font-medium text-[#061c3d] mt-3">User-Friendly Interface</h1>
            <p className="text-xs font-thin text-[#687589]">Easily manage, transfer, and verify ownership
              with an intuitive, user-centric design.</p>
          </div>
          <div className="max-w-96 w-72  h-48 border border-[#b7c8c87d] rounded-xl p-5 pb-7 shadow-xl hover:scale-105 duration-150 ease-in-out">
            <Image src={PowerAsset} alt="" className="w-10 h-auto" />
            <h1 className="text-xl font-medium text-[#061c3d] mt-3">Powered Asset Ownership</h1>
            <p className="text-xs font-thin text-[#687589]">Ensure secure, transparent, and decentralized
              ownership records for all types of assets.</p>
          </div>
        </div>
      </div>

      <footer className="bg-[#263238]">
        <div className="w-full max-w-screen-xl mx-auto p-4 md:py-8">
          <span className="block text-xs font-bold sm:text-center !text-center text-white">
            Copyright © 2024{" "}
            <a href="https://flowbite.com/" className="hover:underline">
              Ownership™
            </a>
            .<br />
            <span className="font-thin text-[8px]">All Rights Reserved.</span>
          </span>
        </div>
      </footer>
      {isLoginVisible && <LoginPopup onClose={closeLogin} />}
    </>
  );
}
