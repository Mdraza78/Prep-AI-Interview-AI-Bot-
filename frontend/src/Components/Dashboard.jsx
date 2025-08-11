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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserProfile from "./UserProfile";
import ScoresList from "./ScoresList";
import Leaderboard from "./Leaderboard";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      fetch("http://localhost:5000/api/user/upload-resume", {
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

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-72" : "w-0"} bg-gray-800 flex flex-col transition-all duration-300 overflow-hidden border-r border-gray-700`}
        style={{ minWidth: sidebarOpen ? "18rem" : 0 }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-6" style={fadeSlideInStyle("0.05s")}>
            <div className="bg-green-600 rounded-md p-2">
              <Bot size={48} className="text-white" />
            </div>
            {sidebarOpen && (
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-white mb-0">Prep Mind</h1>
                <p className="text-gray-400 text-xs">Smart Preparation</p>
              </div>
            )}
          </div>

          {/* Menu items - spaced down */}
          <nav className="flex flex-col gap-1 flex-1 mt-8">
            {menuItems.map(({ icon: Icon, label }, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(label)}
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
                {sidebarOpen && <span>{label}</span>}
              </button>
            ))}
          </nav>

          {/* Divider + Logout */}
          {/* Divider + Logout */}
{sidebarOpen && (
  <>
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
  </>
)}

        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-grow h-screen overflow-hidden">
        {/* Navbar */}
        <div
          className="flex items-center justify-between px-10 bg-gray-900"
          style={{ height: 70, minHeight: 70, ...fadeSlideInStyle("0.15s") }}
        >
          <button
            className="p-2 rounded hover:bg-gray-800"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
          >
            <Menu size={32} className="text-white" />
          </button>
          <span className="text-white font-semibold text-base ml-auto">
            Hello, {userName}
          </span>
        </div>
        <hr className="border-gray-700" />

        {/* Page Content */}
        <main className="overflow-auto bg-gray-900 p-10 flex-grow">
          <div className="max-w-3xl mx-auto">
            {currentPage === "Upload Resume" && (
              <>
                {/* Upload Resume Section */}
                <div className="flex justify-between items-center mb-8" style={fadeSlideInStyle("0.22s")}>
                  <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <Upload size={28} className="text-green-500" />
                      Upload Resume
                    </h2>
                    <p className="text-gray-400">
                      Upload your resume and let AI analyze it for interview preparation
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <FileText size={18} />
                    <span>PDF format only</span>
                  </div>
                </div>
                <form onSubmit={(e) => e.preventDefault()}>
                  <div
                    style={fadeSlideInStyle("0.32s")}
                    className={`rounded-xl border-2 border-dashed ${
                      dragActive ? "border-green-400 bg-gray-700/60" : "border-gray-600 bg-gray-700/40"
                    } flex flex-col items-center justify-center cursor-pointer py-10`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => inputRef.current.click()}
                  >
                    <div className="bg-green-600 rounded-full p-4 mb-3 animate-pulse">
                      <Plus size={40} className="text-white" />
                    </div>
                    <div className="mb-2 text-xl font-semibold text-white">
                      {file ? file.name : "Drop your resume here"}
                    </div>
                    <div className="mb-3 text-gray-400">
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
                    <div className="text-xs text-gray-500">
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
                        className="px-3 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                      >
                        Start Interview
                      </button>
                    </div>
                  )}
                </form>
                {/* Guidelines */}
                <div style={fadeSlideInStyle("0.48s")} className="mt-10">
                  <hr className="border-gray-700 mb-6" />
                  <h3 className="mb-4 text-xl font-semibold text-white">Upload Guidelines</h3>
                  <ul className="space-y-3">
                    {[
                      "Use a professional, well-formatted PDF resume",
                      "Include relevant work experience and skills",
                      "Ensure the text is readable and not image-based",
                      "PDF file size should not exceed 10MB",
                    ].map((text, index) => (
                      <li
                        key={index}
                        className="text-gray-400 flex items-center gap-2"
                        style={fadeSlideInStyle(`${0.52 + index * 0.04}s`)}
                      >
                        <CheckCircle size={16} className="text-green-500" />
                        {text}
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
          <div className="max-w-3xl mx-auto mt-20" style={fadeSlideInStyle("0.7s")}>
            <hr className="border-gray-700 mb-4" />
            <footer className="text-center text-xs text-gray-500">
              © 2025 Prep Mind. All rights reserved.
              <br /><br />Made with ❤️ by Md Raza.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
