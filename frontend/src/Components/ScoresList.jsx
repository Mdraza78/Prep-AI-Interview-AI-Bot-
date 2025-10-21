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
  ChevronRight,
  BarChart3,
  FileText
} from "lucide-react";
import { API_URLS } from "../config/api";

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

  const attemptsPerPage = 5;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    async function fetchScores() {
      try {
        setLoading(true);
        const res = await fetch(API_URLS.RESULTS, {
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-gray-300 text-lg font-medium">Loading your test history...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md mx-auto">
          <div className="text-red-400 text-lg font-semibold mb-2">Error Loading Results</div>
          <div className="text-gray-300">{error}</div>
        </div>
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="text-center py-20">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
          <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <div className="text-gray-300 text-lg font-medium mb-2">No Test History Found</div>
          <div className="text-gray-400 text-sm">Complete your first interview to see results here</div>
        </div>
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

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {!activeDetailAttempt ? (
          <>
            {/* Header */}
            <div className="mb-8 text-center" style={fadeSlideInStyle("0.1s")}>
              <div className="flex items-center justify-center gap-3 mb-3">
                <BarChart3 className="w-8 h-8 text-emerald-400" />
                <h1 className="text-3xl font-bold text-white">Test Results</h1>
              </div>
              <p className="text-gray-400">Track your interview performance and progress</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {/* Total Tests */}
              <div
                style={fadeSlideInStyle("0.2s")}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-emerald-500/30 transition-all duration-300 hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-500/10 rounded-lg p-3">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{totalTests}</div>
                    <div className="text-gray-400 text-sm">Total Tests</div>
                  </div>
                </div>
              </div>

              {/* Average Score */}
              <div
                style={fadeSlideInStyle("0.3s")}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-emerald-500/30 transition-all duration-300 hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-500/10 rounded-lg p-3">
                    <Target className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{averageScore}</div>
                    <div className="text-gray-400 text-sm">Average Score</div>
                  </div>
                </div>
              </div>

              {/* Best Score */}
              <div
                style={fadeSlideInStyle("0.4s")}
                className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-emerald-500/30 transition-all duration-300 hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-500/10 rounded-lg p-3">
                    <Award className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{bestScore}</div>
                    <div className="text-gray-400 text-sm">Best Score</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attempts List */}
            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Recent Test Results
              </h2>
              
              <div className="space-y-4">
                {currentAttempts.map((attempt, idx) => {
                  const [datePart, timePart] = formatDateTime(attempt.createdAt).split(", ");
                  const percentage = Math.round(attempt.totalScore);
                  const attemptNumber = totalTests - (startIndex + idx);
                  
                  return (
                    <div
                      key={attempt._id || idx}
                      style={fadeSlideInStyle(`${0.1 * (idx + 1)}s`)}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 hover:border-emerald-500/30 transition-all duration-300"
                    >
                      <div className="flex flex-col gap-4">
                        {/* Header Row - Mobile Optimized */}
                        <div className="flex justify-between items-start">
                          <div className="bg-emerald-500/10 rounded-lg px-3 py-1">
                            <span className="text-emerald-400 font-semibold text-sm">
                              Attempt #{attemptNumber}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-emerald-400 text-right">
                            {percentage}%
                          </div>
                        </div>
                        
                        {/* Date and Time */}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{datePart}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{timePart}</span>
                          </div>
                        </div>
                        
                        {/* Score */}
                        <div className="flex items-center gap-2 text-sm">
                          <Target className="w-4 h-4 text-emerald-400" />
                          <span className="text-gray-300">
                            {attempt.totalScore} out of 100 points
                          </span>
                        </div>
                        
                        {/* View Details Button - Centered with Icon */}
                        <div className="flex justify-center mt-2">
                          <button
                            onClick={() => setActiveDetailAttempt(attempt)}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors duration-200 font-medium w-full sm:w-auto justify-center"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-gray-700">
                  <div className="text-gray-400 text-sm">
                    Showing {startIndex + 1}-{Math.min(startIndex + attemptsPerPage, attemptsSorted.length)} of {attemptsSorted.length} attempts
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg transition-colors duration-200 ${
                        currentPage === 1
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors duration-200 ${
                            currentPage === page
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-lg transition-colors duration-200 ${
                        currentPage === totalPages
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          // Detail View - Mobile Optimized
          <div className="max-w-4xl mx-auto">
            <div
              style={fadeSlideInStyle("0.1s")}
              className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 sm:p-6"
            >
              {/* Professional Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-700">
                <button
                  onClick={() => setActiveDetailAttempt(null)}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 w-full sm:w-auto justify-center sm:justify-start order-2 sm:order-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Results</span>
                </button>
                
                <div className="text-center order-1 sm:order-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Attempt Details</h3>
                  <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-2">
                    <div className="text-emerald-300 text-lg font-semibold">
                      Score: {activeDetailAttempt.totalScore}/100
                    </div>
                  </div>
                </div>
                
                <div className="w-full sm:w-20 order-3 sm:order-3"></div> {/* Spacer for alignment */}
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {activeDetailAttempt.questions?.map((q, qidx) => (
                  <div
                    key={qidx}
                    style={fadeSlideInStyle(`${0.1 * (qidx + 1)}s`)}
                    className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Question Header */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-4 py-3 bg-gray-700/50 border-b border-gray-600 gap-2">
                      <span className="text-emerald-300 font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        Question {qidx + 1}
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-semibold w-fit">
                        {q.individualScore} / 20
                      </span>
                    </div>
                    
                    {/* Question Content */}
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="text-gray-400 text-sm font-medium mb-2">Question:</div>
                        <div className="text-white bg-gray-800/50 rounded-lg p-3 border border-gray-700 text-sm sm:text-base">
                          {q.question}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-gray-400 text-sm font-medium mb-2">Your Answer:</div>
                        <div className="text-gray-300 bg-gray-800/30 rounded-lg p-3 border border-gray-700 text-sm sm:text-base">
                          {q.answer || "No answer provided"}
                        </div>
                      </div>
                      
                      {q.feedback && (
                        <div>
                          <div className="text-gray-400 text-sm font-medium mb-2">Feedback:</div>
                          <div className="text-amber-300 bg-amber-500/10 rounded-lg p-3 border border-amber-500/20 italic text-sm sm:text-base">
                            {q.feedback}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}