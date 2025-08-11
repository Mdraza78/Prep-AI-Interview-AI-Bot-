import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Target,
  Award,
  Calendar,
  Clock,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Format date/time function
function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ScoresList() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDetailAttempt, setActiveDetailAttempt] = useState(null);

  const attemptsPerPage = 5; // show only 5 attempts per page
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    async function fetchScores() {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5000/api/user/results", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResults(data.results);
      } catch (err) {
        setError(err.message || "Could not load results");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchScores();
  }, [token]);

  if (loading) {
    return (
      <div className="text-center py-24 text-green-400 font-semibold text-xl">
        Loading your test history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24 text-red-500 font-semibold text-xl">
        Error: {error}
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="text-center py-24 text-gray-300 text-lg">
        No test history found.
      </div>
    );
  }

  // Sort newest first
  const attemptsSorted = [...results].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Pagination calc
  const totalPages = Math.ceil(attemptsSorted.length / attemptsPerPage);
  const startIndex = (currentPage - 1) * attemptsPerPage;
  const currentAttempts = attemptsSorted.slice(
    startIndex,
    startIndex + attemptsPerPage
  );

  // Summary metrics
  const totalTests = attemptsSorted.length;
  const averageScore =
    totalTests > 0
      ? Math.round(
          attemptsSorted.reduce(
            (sum, att) => sum + (att.totalScore || 0),
            0
          ) / totalTests
        )
      : 0;
  const bestScore =
    totalTests > 0
      ? Math.max(...attemptsSorted.map((att) => att.totalScore || 0))
      : 0;

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

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-[820px] mx-auto pt-4 pb-6 px-4">
        {!activeDetailAttempt ? (
          <>
            {/* Summary Cards */}
            <div className="flex flex-col sm:flex-row gap-5 mb-9">
              {/* Total Tests */}
              <div
                style={fadeSlideInStyle("0.1s")}
                className="flex items-center gap-4 rounded-xl border border-gray-700 bg-[#222B3A] shadow-lg py-7 px-6 w-[250px] hover:scale-105 transition-transform"
              >
                <div className="bg-green-400/10 rounded-lg p-3 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <div className="text-white font-bold text-2xl">{totalTests}</div>
                  <div className="text-gray-300 text-base">Total Tests</div>
                </div>
              </div>
              {/* Average Score */}
              <div
                style={fadeSlideInStyle("0.3s")}
                className="flex items-center gap-4 rounded-xl border border-gray-700 bg-[#222B3A] shadow-lg py-7 px-6 w-[250px] hover:scale-105 transition-transform"
              >
                <div className="bg-green-400/10 rounded-lg p-3 flex items-center justify-center">
                  <Target className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <div className="text-white font-bold text-2xl">{averageScore}</div>
                  <div className="text-gray-300 text-base">Average Score</div>
                </div>
              </div>
              {/* Best Score */}
              <div
                style={fadeSlideInStyle("0.5s")}
                className="flex items-center gap-4 rounded-xl border border-gray-700 bg-[#222B3A] shadow-lg py-7 px-6 w-[250px] hover:scale-105 transition-transform"
              >
                <div className="bg-green-400/10 rounded-lg p-3 flex items-center justify-center">
                  <Award className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <div className="text-white font-bold text-2xl">{bestScore}</div>
                  <div className="text-gray-300 text-base">Best Score</div>
                </div>
              </div>
            </div>

            {/* Attempts List */}
            <h5 className="text-white text-3xl mb-7">Recent Test Results</h5>
            <div className="flex flex-col gap-7">
              {currentAttempts.map((attempt, idx) => {
                const [datePart, timePart] = formatDateTime(attempt.createdAt).split(", ");
                const percentage = Math.round(attempt.totalScore);
                return (
                  <div
                    key={attempt._id || idx}
                    style={fadeSlideInStyle(`${0.1 * (idx + 1)}s`)}
                    className="rounded-xl border border-gray-700 bg-[#222B3A] shadow-lg p-6"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-white font-semibold text-lg">
                          Attempt #{totalTests - (startIndex + idx)}
                        </div>
                        <div className="text-xs text-gray-400 mt-2 flex gap-6">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> {datePart}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" /> {timePart}
                          </div>
                        </div>
                        <div className="text-green-400 mt-4 flex items-center gap-2">
                          <Target className="w-5 h-5" />
                          <span className="text-white">
                            {attempt.totalScore}/100 marks
                          </span>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-green-400">
                        {percentage}%
                      </div>
                    </div>
                    <div className="mt-6 border-t border-gray-600 pt-3">
                      <button
                        onClick={() => setActiveDetailAttempt(attempt)}
                        className="w-full text-center font-medium hover:text-green-300 text-gray-200 flex justify-center items-center gap-2"
                      >
                        <Eye className="w-5 h-5" /> View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination - lucide-react version */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-6 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-full ${
                    currentPage === 1
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-full ${
                    currentPage === totalPages
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        ) : (
          // Detail View
          <div
            style={fadeSlideInStyle("0.1s")}
            className="rounded-xl border border-gray-700 bg-[#222B3A] shadow-lg p-8 mx-auto max-w-2xl"
          >
            <button
              onClick={() => setActiveDetailAttempt(null)}
              className="mb-6 px-4 py-2 bg-gray-700 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            <h3 className="text-2xl font-semibold mb-8 text-center">Attempt Details</h3>

            <div className="flex flex-col gap-6">
              {activeDetailAttempt.questions?.map((q, qidx) => (
                <div
                  key={qidx}
                  style={fadeSlideInStyle(`${0.1 * (qidx + 1)}s`)}
                  className="rounded-xl border border-gray-700 bg-[#1B232F] shadow"
                >
                  <div className="flex justify-between items-center px-5 py-2 bg-[#222B3A] border-b border-gray-700">
                    <span className="text-green-300 font-semibold">
                      Question {qidx + 1}
                    </span>
                    <span className="text-green-400 font-semibold text-sm">
                      {q.individualScore} / 20
                    </span>
                  </div>
                  <div className="px-5 py-4">
                    <div className="font-semibold">{q.question}</div>
                    <div className="mt-2 text-gray-300">
                      <span className="font-semibold">Your answer:</span> {q.answer}
                    </div>
                    {q.feedback && (
                      <div className="mt-2 italic">
                        <span className="font-semibold">Feedback:</span> {q.feedback}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
