import React, { useState, useRef } from "react";
import {
  Menu,
  Upload,
  UserCircle2,
  Bot,
  Plus,
  FileText,
  Award,
  CheckCircle,
  Trophy,
  LogOut,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserProfile from "./UserProfile";
import ScoresList from "./ScoresList";
import Leaderboard from "./Leaderboard";
import { API_URLS } from "../config/api";

const fadeSlideInStyle = (delay) => ({
  animationName: "fadeSlideIn",
  animationDuration: "0.7s",
  animationTimingFunction: "ease-out",
  animationFillMode: "forwards",
  animationDelay: delay,
  opacity: 0,
  transform: "translateY(1rem)",
});

const menuItems = [
  { icon: Upload, label: "Upload Resume" },
  { icon: Award, label: "View Scores" },
  { icon: UserCircle2, label: "Account" },
  { icon: Trophy, label: "Leaderboard" },
];

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef();
  const [currentPage, setCurrentPage] = useState("Upload Resume");
  const navigate = useNavigate();

  const userName = localStorage.getItem("name") || "User";

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile && selectedFile.type === "application/pdf") {
      const formData = new FormData();
      formData.append("resume", selectedFile);
      fetch(API_URLS.UPLOAD_RESUME, {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.text) {
            localStorage.setItem("resumeText", data.text);
          }
        })
        .catch((err) => console.error("Upload failed:", err));
    }
  };

  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = () => setDragActive(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) {
      handleFileChange({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleMenuClick = (label) => {
    setCurrentPage(label);
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile Full Screen */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-50 w-full lg:w-72 bg-gray-800 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden border-r border-gray-700 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo and Close Button */}
          <div className="flex items-center justify-between px-6 py-6" style={fadeSlideInStyle("0.05s")}>
            <div className="flex items-center">
              <div className="bg-green-600 rounded-md p-2">
                <Bot size={48} className="text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-white mb-0">Prep Mind</h1>
                <p className="text-gray-400 text-xs">Smart Preparation</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              className="lg:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={24} />
            </button>
          </div>

          {/* Menu items */}
          <nav className="flex flex-col gap-1 flex-1 mt-8">
            {menuItems.map(({ icon: Icon, label }, idx) => (
              <button
                key={idx}
                onClick={() => handleMenuClick(label)}
                style={fadeSlideInStyle(`${0.15 + idx * 0.1}s`)}
                className={`flex items-center gap-4 px-6 py-3 text-base rounded-md font-medium transition-colors ${
                  currentPage === label
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                <Icon
                  size={20}
                  className={currentPage === label ? "text-white" : "text-green-500"}
                />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Divider + Logout */}
          <div className="mt-auto">
            <hr className="border-t border-gray-700 my-3 mx-6" />
            <div className="px-6 mb-8">
              <button
                onClick={handleLogout}
                className={`
                  group
                  flex items-center gap-2 w-full
                  text-red-500 font-semibold text-base
                  px-0 py-2
                  rounded-md border border-transparent
                  transition-all duration-300 ease-out
                  outline-none
                `}
                style={{ justifyContent: "flex-start" }}
              >
                <LogOut
                  size={18}
                  className="transition-transform duration-300 ease-out group-hover:-translate-x-1"
                />
                <span
                  className="transition-colors duration-300 ease-out text-red-500"
                >
                  Logout
                </span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-grow h-screen overflow-hidden w-full">
        {/* Navbar */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 lg:px-10 bg-gray-900"
          style={{ height: 70, minHeight: 70, ...fadeSlideInStyle("0.15s") }}
        >
          <button
            className="p-2 rounded hover:bg-gray-800 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Toggle sidebar"
          >
            <Menu size={24} className="text-white" />
          </button>
          <span className="text-white font-semibold text-base lg:ml-auto text-center flex-1 lg:flex-none">
            Hello, {userName}
          </span>
          {/* Spacer for mobile to center the text */}
          <div className="w-10 lg:hidden" />
        </div>
        <hr className="border-gray-700" />

        {/* Page Content */}
        <main className="overflow-auto bg-gray-900 p-4 sm:p-6 lg:p-10 flex-grow">
          <div className="max-w-3xl mx-auto w-full">
            {currentPage === "Upload Resume" && (
              <>
                {/* Upload Resume Section */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8" style={fadeSlideInStyle("0.22s")}>
                  <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3 mb-2">
                      <Upload size={24} className="text-green-500" />
                      Upload Resume
                    </h2>
                    <p className="text-gray-400 text-sm sm:text-base">
                      Upload your resume and let AI analyze it for interview preparation
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm sm:text-base">
                    <FileText size={16} />
                    <span>PDF format only</span>
                  </div>
                </div>
                
                <form onSubmit={(e) => e.preventDefault()}>
                  <div
                    style={fadeSlideInStyle("0.32s")}
                    className={`rounded-xl border-2 border-dashed ${
                      dragActive ? "border-green-400 bg-gray-700/60" : "border-gray-600 bg-gray-700/40"
                    } flex flex-col items-center justify-center cursor-pointer py-8 sm:py-10 px-4`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => inputRef.current.click()}
                  >
                    <div className="bg-green-600 rounded-full p-3 sm:p-4 mb-3 animate-pulse">
                      <Plus size={32} className="text-white" />
                    </div>
                    <div className="mb-2 text-lg sm:text-xl font-semibold text-white text-center">
                      {file ? file.name : "Drop your resume here"}
                    </div>
                    <div className="mb-3 text-gray-400 text-sm sm:text-base text-center">
                      or{" "}
                      <span
                        className="cursor-pointer underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          inputRef.current.click();
                        }}
                      >
                        browse files
                      </span>{" "}
                      to upload
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      Supports PDF files up to 10MB
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      ref={inputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  
                  {file && (
                    <div className="mt-6 flex justify-end" style={fadeSlideInStyle("0.38s")}>
                      <button
                        type="button"
                        onClick={() => navigate("/test")}
                        className="px-4 py-2 sm:px-6 sm:py-2 text-sm sm:text-base font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition w-full sm:w-auto"
                      >
                        Start Interview
                      </button>
                    </div>
                  )}
                </form>
                
                {/* Guidelines */}
                <div style={fadeSlideInStyle("0.48s")} className="mt-8 sm:mt-10">
                  <hr className="border-gray-700 mb-4 sm:mb-6" />
                  <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold text-white">Upload Guidelines</h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {[
                      "Use a professional, well-formatted PDF resume",
                      "Include relevant work experience and skills",
                      "Ensure the text is readable and not image-based",
                      "PDF file size should not exceed 10MB",
                    ].map((text, index) => (
                      <li
                        key={index}
                        className="text-gray-400 flex items-start gap-2 text-sm sm:text-base"
                        style={fadeSlideInStyle(`${0.52 + index * 0.04}s`)}
                      >
                        <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            {currentPage === "View Scores" && <ScoresList />}
            {currentPage === "Account" && <UserProfile />}
            {currentPage === "Leaderboard" && <Leaderboard />}
          </div>
          
          {/* Footer */}
          <div className="max-w-3xl mx-auto mt-12 sm:mt-20" style={fadeSlideInStyle("0.7s")}>
            <hr className="border-gray-700 mb-4" />
            <footer className="text-center text-xs text-gray-500">
              © 2025 Prep Mind. All rights reserved.
              <br className="sm:hidden" />
              <br className="sm:hidden" />
              Made with ❤️ by Md Raza.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}