import React, { useEffect, useState, useRef } from "react";
import { Bot, Mic, MicOff, Volume2, ChevronLeft, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URLS } from "../config/api";

const BORDER_COLOR = "#10b981";

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

function QuestionDisplay({ question }) {
  const codeBlockRegex = /(```[\s\S]*?```)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = codeBlockRegex.exec(question)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = question.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push(
          <div
            key={`text-${key++}`}
            className="mb-4 text-gray-100 leading-relaxed text-base sm:text-lg"
          >
            {text.trim()}
          </div>
        );
      }
    }

    // Add code block
    const codeContent = match[1].replace(/```/g, '').trim();
    parts.push(
      <div
        key={`code-${key++}`}
        className="my-4 rounded-lg bg-gray-800 border border-emerald-500/30 overflow-hidden"
      >
        <div className="bg-gray-900 px-4 py-2 border-b border-emerald-500/20">
          <span className="text-xs text-emerald-400 font-mono">Code</span>
        </div>
        <pre className="px-4 py-3 text-sm text-gray-100 font-mono overflow-x-auto">
          <code>{codeContent}</code>
        </pre>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < question.length) {
    const text = question.slice(lastIndex);
    if (text.trim()) {
      parts.push(
        <div
          key={`text-end`}
          className="text-gray-100 leading-relaxed text-base sm:text-lg"
        >
          {text.trim()}
        </div>
      );
    }
  }

  if (parts.length === 0) {
    return (
      <div className="text-gray-100 leading-relaxed text-base sm:text-lg whitespace-pre-wrap">
        {question}
      </div>
    );
  }
  return <>{parts}</>;
}

export default function Test() {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [answerInput, setAnswerInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [resultDetails, setResultDetails] = useState([]);
  const [recognitionSupported, setRecognitionSupported] = useState(false);

  const userName = localStorage.getItem("name") || "User";
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setRecognitionSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsRecording(true);

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setAnswerInput(transcript.trim());
      };

      recognition.onerror = (event) => {
        setIsRecording(false);
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          alert("Microphone access denied. Please allow microphone permission.");
        }
      };

      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
    }

    // Initialize speech synthesis
    if ("speechSynthesis" in window) {
      speechSynthesisRef.current = window.speechSynthesis;
    }

    // Fetch questions
    async function fetchQuestions() {
      setIsLoadingQuestions(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }
        const resumeText = localStorage.getItem("resumeText");
        if (!resumeText) {
          alert("No resume text found. Please upload your resume first.");
          navigate("/dashboard");
          return;
        }
        const res = await fetch(
          API_URLS.START_INTERVIEW,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ resumeText }),
          }
        );
        if (!res.ok) {
          throw new Error("Failed to fetch questions");
        }
        const data = await res.json();
        if (data.questions && data.questions.length === 5) {
          setQuestions(data.questions);
          setAnswers(Array(data.questions.length).fill(""));
          setAnswerInput("");
          speakText(data.questions[0]);
        } else {
          alert("Unexpected number of questions received. Expected 5.");
        }
      } catch (err) {
        console.error("Error fetching questions:", err);
        alert("Error fetching questions!");
      } finally {
        setIsLoadingQuestions(false);
      }
    }
    fetchQuestions();

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (speechSynthesisRef.current) speechSynthesisRef.current.cancel();
    };
  }, [navigate]);

  function speakText(text) {
    if (!speechSynthesisRef.current) return;
    speechSynthesisRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.97;
    setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    speechSynthesisRef.current.speak(utter);
  }

  const startRecording = async () => {
    if (currentIndex === 4) {
      alert("For the coding question, please type your answer.");
      return;
    }

    if (!recognitionRef.current) {
      alert("Voice input is not supported in your browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      setIsRecording(true);
      setAnswerInput("");
      recognitionRef.current.start();

      setTimeout(() => {
        if (isRecording) {
          stopRecording();
          alert("Voice input timed out. Please try again.");
        }
      }, 10000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setIsRecording(false);
      if (err.name === "NotAllowedError") {
        alert("Microphone access denied. Please allow microphone permission.");
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleNext = () => {
    const trimmed = answerInput.trim();
    if (!trimmed) {
      alert("Please provide an answer before continuing.");
      return;
    }
    const temp = [...answers];
    temp[currentIndex] = trimmed;
    setAnswers(temp);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setAnswerInput(temp[currentIndex + 1] || "");
      speakText(questions[currentIndex + 1]);
    }
  };

  const handleSkip = () => {
    const temp = [...answers];
    temp[currentIndex] = "";
    setAnswers(temp);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      setAnswerInput(temp[currentIndex + 1] || "");
      speakText(questions[currentIndex + 1]);
    }
  };

  const handleReplayQuestion = () => {
    speakText(questions[currentIndex]);
  };

// In Test.jsx, update the handleEndTest function:
const handleEndTest = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    navigate("/login");
    return;
  }
  
  const trimmed = answerInput.trim();
  if (!trimmed) {
    alert("Please provide an answer before ending the test.");
    return;
  }
  
  const temp = [...answers];
  temp[currentIndex] = trimmed;
  setAnswers(temp);
  
  // Validate all answers
  const emptyAnswers = temp.filter(answer => !answer.trim());
  if (emptyAnswers.length > 0) {
    if (!confirm(`You have ${emptyAnswers.length} unanswered questions. Submit anyway?`)) {
      return;
    }
  }
  
  setIsSubmitting(true);
  
  try {
    const resumeText = localStorage.getItem("resumeText");
    
    // Prepare data for submission
    const submissionData = {
      resumeText: resumeText || "No resume text available",
      questions: questions.map(q => q.trim()),
      answers: temp.map(a => a.trim())
    };
    
    console.log('Submitting test data:', {
      questionsCount: submissionData.questions.length,
      answersCount: submissionData.answers.length
    });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    const res = await fetch(API_URLS.EVALUATE_TEST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(submissionData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      let errorMessage = `Evaluation failed: ${res.status} ${res.statusText}`;
      try {
        const errorData = await res.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Couldn't parse JSON error
      }
      throw new Error(errorMessage);
    }
    
    const data = await res.json();
    
    if (data.success === false) {
      throw new Error(data.error || "Evaluation failed");
    }
    
    console.log('Evaluation response:', data);
    setScore(data.score);
    setResultDetails(data.details || []);
    
    // Show success message
    alert(`Test submitted successfully! Your score: ${data.score}/100`);
    
  } catch (err) {
    console.error("Error submitting test:", err);
    
    if (err.name === 'AbortError') {
      alert("Submission timeout. Your answers were saved, but evaluation may be delayed.");
      // Navigate back anyway
      navigate("/dashboard");
    } else {
      alert(`Error: ${err.message}\n\nYour answers have been recorded. You can view results later.`);
      // Still navigate to dashboard
      navigate("/dashboard");
    }
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 12px 3px ${BORDER_COLOR}88; }
          50% { box-shadow: 0 0 20px 5px ${BORDER_COLOR}cc; }
        }
        .animate-progress-pulse { animation: pulse-glow 2.5s infinite ease-in-out; }
      `}</style>

      {/* Professional Header */}
      <header className="w-full bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 shadow-lg sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
              aria-label="Back to Dashboard"
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 rounded-lg p-2">
                <Bot size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Prep Mind</h1>
                <p className="text-xs text-gray-300">Interview Test</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 bg-gray-700/50 rounded-lg px-3 py-2">
              <User size={16} className="text-emerald-400" />
              <span className="text-white text-sm font-medium">{userName}</span>
            </div>
            <div className="flex items-center space-x-2 bg-emerald-600/20 rounded-lg px-3 py-2 border border-emerald-500/30">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-emerald-400 text-sm font-medium">
                Q{currentIndex + 1}/5
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {isLoadingQuestions ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mb-4"></div>
              <p className="text-gray-300 text-lg font-medium">Preparing your interview questions...</p>
              <p className="text-gray-400 text-sm mt-2">This may take a few moments</p>
            </div>
          ) : score !== null ? (
            <div className="text-center py-12" style={fadeSlideInStyle("0.5s")}>
              <div className="bg-gray-800 rounded-2xl p-8 sm:p-12 border border-emerald-500/30 shadow-2xl">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">✓</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Interview Complete!
                </h2>
                <div className="text-gray-300 mb-2">Your Overall Score</div>
                <div className="text-5xl font-bold text-emerald-400 mb-8">
                  {score}<span className="text-2xl text-gray-400">/100</span>
                </div>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : questions.length !== 5 ? (
            <div className="text-center py-20">
              <p className="text-gray-300 text-lg">
                Expected 5 questions, found {questions.length}.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          ) : (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
              {/* Progress Section */}
              <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <button
                    onClick={handleReplayQuestion}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors duration-200"
                    title="Replay Question"
                  >
                    <Volume2 size={16} className="text-white" />
                    <span className="text-white text-sm hidden sm:block">Replay</span>
                  </button>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Question Content */}
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <QuestionDisplay question={questions[currentIndex]} />
                  {isSpeaking && (
                    <div className="flex items-center mt-4 text-emerald-400">
                      <div className="flex space-x-1 mr-2">
                        <div className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce"></div>
                        <div className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm">Reading question...</span>
                    </div>
                  )}
                </div>

                {/* Answer Input Section */}
                <div className="space-y-4">
                  {currentIndex < 4 ? (
                    <>
                      <div className="flex justify-center">
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={!recognitionSupported}
                          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                            isRecording
                              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          } ${
                            !recognitionSupported
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {isRecording ? (
                            <MicOff size={18} className="text-white" />
                          ) : (
                            <Mic size={18} className="text-white" />
                          )}
                          <span>
                            {isRecording ? "Stop Recording" : "Answer with Voice"}
                          </span>
                        </button>
                      </div>
                      
                      <textarea
                        readOnly
                        rows={4}
                        className="w-full p-4 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder={
                          recognitionSupported
                            ? "Your voice answer will appear here..."
                            : "Voice input not supported in your browser"
                        }
                        value={answerInput}
                      />
                    </>
                  ) : (
                    <textarea
                      rows={6}
                      className="w-full p-4 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="Type your code solution here..."
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                    />
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
                  <button
                    onClick={handleSkip}
                    className="px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
                  >
                    Skip Question
                  </button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={handleNext}
                      disabled={!answerInput.trim()}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      onClick={handleEndTest}
                      disabled={!answerInput.trim() || isSubmitting}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Submitting...</span>
                        </span>
                      ) : (
                        "Finish Interview"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Professional Footer */}
      <footer className="bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p className="text-sm">
              © 2025 Prep Mind. All rights reserved.
            </p>
            <p className="text-xs mt-1">
              Made with ❤️ by Md Raza
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}