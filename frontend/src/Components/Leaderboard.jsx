import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMedal, faRankingStar, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { API_URLS } from "../config/api";

// Animation helper
const fadeSlideInStyle = (delay) => ({
  animationName: "fadeSlideIn",
  animationDuration: "0.7s",
  animationTimingFunction: "ease-out",
  animationFillMode: "forwards",
  animationDelay: delay,
  opacity: 0,
  transform: "translateY(1rem)",
});

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;

  const currentUserId = localStorage.getItem("userId");

  useEffect(() => {
    fetch(API_URLS.LEADERBOARD)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Pagination calculation
  const totalPages = Math.ceil(leaderboard.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const currentUsers = leaderboard.slice(startIndex, startIndex + usersPerPage);

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-10 px-3 sm:px-4">
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem);}
          100% { opacity:1; transform:translateY(0);}
        }
      `}</style>

      {/* Heading */}
      <div style={fadeSlideInStyle("0.1s")} className="mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-semibold text-white text-center mb-1">
          <FontAwesomeIcon icon={faRankingStar} className="text-green-400 mr-2" />
          Leaderboard
        </h2>
        <p className="text-gray-400 text-center text-sm sm:text-base px-2">
          Top performers ranked by total points, with attempts, best, and average scores.
        </p>
      </div>

      {/* Table container with horizontal scroll */}
      <div className="shadow-lg rounded-xl border border-gray-800 bg-[#1b2232] overflow-hidden">
        <div className="overflow-x-auto">
          {/* Table */}
          <div className="min-w-[600px]"> {/* Minimum width to ensure table doesn't break */}
            {/* Header row */}
            <div className="grid grid-cols-12 px-4 sm:px-7 py-3 border-b border-gray-800 gap-2 text-center min-w-full">
              <span className="col-span-2 text-xs sm:text-sm text-gray-400 font-semibold">Rank</span>
              <span className="col-span-3 text-xs sm:text-sm text-gray-400 font-semibold">Name</span>
              <span className="col-span-2 text-xs sm:text-sm text-gray-400 font-semibold">Total Attempts</span>
              <span className="col-span-2 text-xs sm:text-sm text-gray-400 font-semibold">Best Score</span>
              <span className="col-span-2 text-xs sm:text-sm text-gray-400 font-semibold">Avg Score</span>
              <span className="col-span-1 text-xs sm:text-sm text-gray-400 font-semibold">Total Points</span>
            </div>

            {/* Body */}
            {loading ? (
              <div className="text-center text-green-400 py-8 sm:py-12 font-bold text-lg sm:text-xl min-w-full">
                Loading leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center text-gray-500 py-8 sm:py-10 min-w-full">No rankings yet.</div>
            ) : (
              currentUsers.map((entry, idx) => {
                const isCurrentUser = entry.userId === currentUserId;
                const medalColor =
                  (startIndex + idx) === 0
                    ? "text-yellow-400"
                    : (startIndex + idx) === 1
                    ? "text-gray-300"
                    : (startIndex + idx) === 2
                    ? "text-amber-700"
                    : "";

                return (
                  <div
                    key={entry.userId}
                    style={fadeSlideInStyle(`${0.2 + idx * 0.07}s`)}
                    className={`grid grid-cols-12 items-center px-4 sm:px-7 py-3 sm:py-4 border-b border-gray-700 text-center min-w-full
                      ${(startIndex + idx) < 3 ? "bg-gray-700/20" : ""}
                      ${isCurrentUser ? "bg-green-500/30 border-l-4 border-l-green-500" : ""}`}
                  >
                    {/* Rank col */}
                    <div className="col-span-2 flex justify-center items-center">
                      {(startIndex + idx) < 3 ? (
                        <FontAwesomeIcon 
                          icon={faMedal} 
                          className={medalColor} 
                          size={window.innerWidth < 640 ? "lg" : "2x"} 
                        />
                      ) : (
                        <span className="text-white font-medium text-base sm:text-lg">
                          {startIndex + idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Name - Full name on all devices */}
                    <div className="col-span-3 flex justify-center items-center gap-2">
                      <span 
                        className={`font-medium ${
                          isCurrentUser ? "text-green-300" : "text-white"
                        } text-sm sm:text-base break-all`}
                        title={entry.name} // Tooltip with full name
                      >
                        {entry.name}
                      </span>
                      {isCurrentUser && (
                        <span className="bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0">
                          You
                        </span>
                      )}
                    </div>

                    {/* Attempts */}
                    <div className="col-span-2 text-white font-normal text-sm sm:text-base">
                      {entry.attempts}
                    </div>

                    {/* Best Score */}
                    <div className="col-span-2 text-white font-normal text-sm sm:text-base">
                      {entry.bestScore}
                    </div>

                    {/* Average Score */}
                    <div className="col-span-2 text-white font-normal text-sm sm:text-base">
                      {entry.averageScore}
                    </div>

                    {/* Total Points */}
                    <div className="col-span-1 text-white font-normal text-sm sm:text-base font-semibold">
                      {entry.totalPoints}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Scroll hint for mobile */}
      <div className="text-center mt-3 sm:hidden">
        <span className="text-gray-500 text-sm">← Scroll horizontally to view full table →</span>
      </div>

      {/* Pagination controls with icons */}
      {leaderboard.length > usersPerPage && (
        <div className="flex justify-center items-center gap-4 sm:gap-6 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className={`p-2 sm:p-3 rounded-full ${
              currentPage === 1
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            <FontAwesomeIcon icon={faChevronLeft} size={window.innerWidth < 640 ? "sm" : "lg"} />
          </button>

          <span className="text-white text-sm sm:text-base">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`p-2 sm:p-3 rounded-full ${
              currentPage === totalPages
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            <FontAwesomeIcon icon={faChevronRight} size={window.innerWidth < 640 ? "sm" : "lg"} />
          </button>
        </div>
      )}
    </div>
  );
}