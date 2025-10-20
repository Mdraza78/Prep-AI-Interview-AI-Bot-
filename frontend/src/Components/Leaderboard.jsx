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
    <div className="max-w-7xl mx-auto py-10 px-2">
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem);}
          100% { opacity:1; transform:translateY(0);}
        }
      `}</style>

      {/* Heading */}
      <div style={fadeSlideInStyle("0.1s")} className="mb-10">
        <h2 className="text-3xl font-semibold text-white text-center mb-1">
          <FontAwesomeIcon icon={faRankingStar} className="text-green-400 mr-2" />
          Leaderboard
        </h2>
        <p className="text-gray-400 text-center">
          Top performers ranked by total points, with attempts, best, and average scores.
        </p>
      </div>

      {/* Table container */}
      <div className="shadow-lg rounded-xl border border-gray-800 bg-[#1b2232] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 px-7 py-3 border-b border-gray-800 gap-2 text-center">
          <span className="col-span-2 text-sm text-gray-400 font-semibold">Rank</span>
          <span className="col-span-3 text-sm text-gray-400 font-semibold">Name</span>
          <span className="col-span-2 text-sm text-gray-400 font-semibold">Total Attempts</span>
          <span className="col-span-1 text-sm text-gray-400 font-semibold">Best Score</span>
          <span className="col-span-2 text-sm text-gray-400 font-semibold">Avg Score</span>
          <span className="col-span-2 text-sm text-gray-400 font-semibold">Total Points</span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="text-center text-green-400 py-12 font-bold text-xl">
            Loading leaderboard...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No rankings yet.</div>
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
               className={`grid grid-cols-12 items-center px-7 py-4 border-b border-gray-700 text-center
  ${(startIndex + idx) < 3 ? "bg-400/10" : ""}
  ${isCurrentUser ? "bg-green-500/40" : ""}`}
              >
                {/* Rank col */}
                <div className="col-span-2 flex justify-center items-center">
                  {(startIndex + idx) < 3 ? (
                    <FontAwesomeIcon icon={faMedal} className={medalColor} size="2x" />
                  ) : (
                    <span className="text-white font-medium text-lg">{startIndex + idx + 1}</span>
                  )}
                </div>

                {/* Name */}
                <div className="col-span-3 flex justify-center items-center gap-2">
                  <span className="text-white font-medium truncate">{entry.name}</span>
                  {isCurrentUser && (
                    <span className="bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded">
                      You
                    </span>
                  )}
                </div>

                {/* Attempts */}
                <div className="col-span-2 text-white font-normal whitespace-nowrap">
                  {entry.attempts}
                </div>

                {/* Best Score */}
                <div className="col-span-1 text-white font-normal whitespace-nowrap">
                  {entry.bestScore}
                </div>

                {/* Average Score */}
                <div className="col-span-2 text-white font-normal whitespace-nowrap">
                  {entry.averageScore}
                </div>

                {/* Total Points */}
                <div className="col-span-2 text-white font-normal whitespace-nowrap">
                  {entry.totalPoints}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls with icons */}
      {leaderboard.length > usersPerPage && (
        <div className="flex justify-center items-center gap-6 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className={`p-2 rounded-full ${
              currentPage === 1
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>

          <span className="text-white">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-full ${
              currentPage === totalPages
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      )}
    </div>
  );
}