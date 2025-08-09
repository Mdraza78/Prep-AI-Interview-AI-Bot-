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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import UserProfile from "./UserProfile"; // Import your UserProfile component

const menuItems = [
  { icon: Upload, label: "Upload Resume" },
  { icon: Award, label: "View Scores" },
  { icon: UserCircle2, label: "Account" },
];

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef();
  const [currentPage, setCurrentPage] = useState("Upload Resume");

  const userName = localStorage.getItem("name") || "User";
  const navigate = useNavigate();

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
            console.log("Extracted resume text:", data.text);
            localStorage.setItem("resumeText", data.text);
          } else {
            console.warn("Could not extract text from the PDF.");
          }
        })
        .catch((err) => {
          console.error("Upload and parse failed:", err);
        });
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange({ target: { files: e.dataTransfer.files } });
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-300 font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } bg-gray-800 flex flex-col transition-all duration-300 overflow-hidden border-r border-gray-700`}
        style={{ minWidth: sidebarOpen ? "18rem" : 0 }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center px-6 py-6 mb-3">
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
          <nav className="flex flex-col mt-2 gap-1">
            {menuItems.map(({ icon: Icon, label }, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(label)}
                className={`flex items-center gap-4 px-6 py-3 text-base rounded-md font-medium transition-colors ${
                  currentPage === label
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
                tabIndex={0}
              >
                <Icon
                  size={20}
                  className={currentPage === label ? "text-white" : "text-green-500"}
                />
                {sidebarOpen && <span>{label}</span>}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-grow h-screen overflow-hidden">
        {/* Navbar */}
        <div
          className="flex items-center justify-between px-10 bg-gray-900"
          style={{ height: 70, minHeight: 70 }}
        >
          <button
            className="p-2 rounded hover:bg-gray-800 focus:outline-none"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle sidebar"
          >
            <Menu size={32} className="text-white" />
          </button>
          <span className="text-white font-semibold text-sm">Hello, {userName}</span>
        </div>

        <hr className="border-gray-700" />

        {/* Main content */}
        <main className="overflow-auto bg-gray-900 p-10 flex-grow">
          <div className="max-w-3xl mx-auto">
            {currentPage === "Upload Resume" && (
              <>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
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
                    <div className="text-xs text-gray-500">Supports PDF files up to 10MB</div>
                    <input
                      type="file"
                      accept="application/pdf"
                      ref={inputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Container to align button to the right */}
                  {file && (
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/test");
                        }}
                        className="px-3 py-2 text-sm font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                      >
                        Start Interview
                      </button>
                    </div>
                  )}
                </form>

                {/* Guidelines */}
                <div className="mt-10">
                  <hr className="border-gray-700 mb-6" />
                  <h3 className="mb-4 text-xl font-semibold text-white">Upload Guidelines</h3>
                  <ul className="space-y-3">
                    {[
                      "Use a professional, well-formatted PDF resume",
                      "Include relevant work experience and skills",
                      "Ensure the text is readable and not image-based",
                      "PDF file size should not exceed 10MB",
                    ].map((text, index) => (
                      <li key={index} className="text-gray-400 flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            {currentPage === "View Scores" && (
              <div className="text-center text-white text-xl font-semibold">
                Scores coming soon...
              </div>
            )}
            {currentPage === "Account" && <UserProfile />}
          </div>

          {/* Footer */}
          <div className="max-w-3xl mx-auto mt-20">
            <hr className="border-gray-700 mb-4" />
            <footer className="text-center text-xs text-gray-500">
              © 2025 Prep Mind. All rights reserved.
              <br />
              <br />
              Made with ❤️ by Md Raza.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
