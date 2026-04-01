import React, { useEffect, useState, useRef } from "react";
import { Bot, Mic, MicOff, Volume2, ChevronLeft, User, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URLS } from "../config/api";

const BORDER_COLOR = "#10b981";

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
  const [error, setError] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  const userName = localStorage.getItem("name") || "User";
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);

  // Improved speech synthesis function
  const speakText = (text) => {
    if (!window.speechSynthesis) {
      console.log('Speech synthesis not supported');
      setDebugInfo('Speech synthesis not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.error('Error canceling speech:', e);
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.97;
    utter.pitch = 1;
    utter.volume = 1;
    
    // Wait for voices to be loaded
    const speak = () => {
      setIsSpeaking(true);
      utter.onend = () => {
        setIsSpeaking(false);
        console.log('Speech finished');
      };
      utter.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        setDebugInfo(`Speech error: ${event.error}`);
      };
      
      // Small delay to ensure cancel is processed
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utter);
        } catch (e) {
          console.error('Error speaking:', e);
          setIsSpeaking(false);
        }
      }, 100);
    };

    // Check if voices are loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speak();
      };
    } else {
      speak();
    }
  };

  useEffect(() => {
    // Setup speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setRecognitionSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log('Recording started');
        setIsRecording(true);
      };
      
      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        console.log('Transcript:', transcript);
        setAnswerInput(transcript.trim());
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        setDebugInfo(`Speech recognition error: ${event.error}`);
        if (event.error === "not-allowed") {
          alert("Microphone access denied. Please allow microphone permission.");
        }
      };
      
      recognition.onend = () => {
        console.log('Recording ended');
        setIsRecording(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      setDebugInfo('Speech recognition not supported in this browser');
    }

    // Fetch questions
    async function fetchQuestions() {
      setIsLoadingQuestions(true);
      setError(null);
      setDebugInfo("Fetching questions from server...");
      
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("No token found");
          navigate("/login");
          return;
        }
        
        const resumeText = localStorage.getItem("resumeText");
        if (!resumeText) {
          console.error("No resume text found");
          alert("No resume text found. Please upload your resume first.");
          navigate("/dashboard");
          return;
        }
        
        console.log("Sending request to:", API_URLS.START_INTERVIEW);
        console.log("Resume text length:", resumeText.length);
        
        const res = await fetch(API_URLS.START_INTERVIEW, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ resumeText }),
        });
        
        console.log("Response status:", res.status);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error("Error response:", errorData);
          throw new Error(errorData.error || `Failed to fetch questions (Status: ${res.status})`);
        }
        
        const data = await res.json();
        console.log("Questions received:", data);
        setDebugInfo(`Received ${data.questions?.length || 0} questions`);
        
        if (data.questions && data.questions.length === 5) {
          setQuestions(data.questions);
          setAnswers(Array(data.questions.length).fill(""));
          setAnswerInput("");
          
          // Small delay before speaking first question
          setTimeout(() => {
            console.log("Speaking first question:", data.questions[0]);
            speakText(data.questions[0]);
          }, 500);
        } else {
          console.warn("Unexpected number of questions:", data.questions?.length);
          alert(`Unexpected number of questions received. Expected 5, got ${data.questions?.length || 0}.`);
        }
      } catch (err) {
        console.error("Error fetching questions:", err);
        setError(err.message || "Error fetching questions!");
        setDebugInfo(`Error: ${err.message}`);
      } finally {
        setIsLoadingQuestions(false);
      }
    }
    
    fetchQuestions();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          console.error('Error canceling speech:', e);
        }
      }
    };
  }, [navigate]);

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
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      setIsRecording(true);
      setAnswerInput("");
      recognitionRef.current.start();

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (recognitionRef.current && isRecording) {
          recognitionRef.current.stop();
        }
      }, 30000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setIsRecording(false);
      if (err.name === "NotAllowedError") {
        alert("Microphone access denied. Please allow microphone permission.");
      } else if (err.name === "NotFoundError") {
        alert("No microphone found on your device.");
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
    if (questions[currentIndex]) {
      speakText(questions[currentIndex]);
    }
  };

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
    setIsSubmitting(true);
    setError(null);
    setRetryMessage("");
    setDebugInfo("Submitting answers for evaluation...");
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const submitEvaluation = async () => {
      try {
        const resumeText = localStorage.getItem("resumeText");
        console.log("Submitting evaluation with", questions.length, "questions");
        
        const res = await fetch(API_URLS.EVALUATE_TEST, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            resumeText,
            questions,
            answers: temp,
          }),
        });
        
        console.log("Evaluation response status:", res.status);
        
        // Handle rate limiting with retry
        if (res.status === 429 && retryCount < maxRetries) {
          retryCount++;
          const delay = 4000 * retryCount;
          setRetryMessage(`⚠️ Rate limit reached. Retrying in ${delay/1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
          setDebugInfo(`Rate limited, retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return submitEvaluation();
        }
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error("Evaluation error:", errorData);
          throw new Error(errorData.error || `Evaluation failed (Status: ${res.status})`);
        }
        
        const data = await res.json();
        console.log("Evaluation results:", data);
        setScore(data.score);
        setResultDetails(data.details || []);
        setShowFeedback(true);
        setError(null);
        setRetryMessage("");
        setDebugInfo(`Evaluation complete! Score: ${data.score}/100`);
      } catch (err) {
        console.error("Error submitting test:", err);
        setError(err.message || "Error submitting test. Please try again.");
        setDebugInfo(`Submission error: ${err.message}`);
        setIsSubmitting(false);
      }
    };
    
    await submitEvaluation();
    setIsSubmitting(false);
  };

  if (score !== null && showFeedback) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <style>{`
          @keyframes fadeSlideIn {
            0% { opacity: 0; transform: translateY(1rem); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <header className="w-full bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 shadow-lg sticky top-0 z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-600 rounded-lg p-2">
                  <Bot size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Prep Mind</h1>
                  <p className="text-xs text-gray-300">Interview Results</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 bg-gray-700/50 rounded-lg px-3 py-2">
                <User size={16} className="text-emerald-400" />
                <span className="text-white text-sm font-medium">{userName}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8" style={fadeSlideInStyle("0.1s")}>
              <div className="bg-gray-800 rounded-2xl p-8 sm:p-12 border border-emerald-500/30 shadow-2xl">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Interview Complete!</h2>
                <div className="text-gray-300 mb-2">Your Overall Score</div>
                <div className="text-5xl font-bold text-emerald-400 mb-8">
                  {score}<span className="text-2xl text-gray-400">/100</span>
                </div>
              </div>
            </div>

            <div className="mt-8" style={fadeSlideInStyle("0.3s")}>
              <h3 className="text-2xl font-bold text-white mb-6 text-center">Detailed Feedback</h3>
              <div className="space-y-6">
                {resultDetails.map((detail, idx) => (
                  <div
                    key={idx}
                    style={fadeSlideInStyle(`${0.4 + idx * 0.1}s`)}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden"
                  >
                    <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <h4 className="text-lg font-semibold text-emerald-400">Question {idx + 1}</h4>
                        <div className="bg-emerald-600/20 px-3 py-1 rounded-full">
                          <span className="text-emerald-400 font-bold">Score: {detail.individualScore}/20</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-2">Question:</p>
                        <p className="text-white text-base leading-relaxed">{detail.question}</p>
                      </div>
                      
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-2">Your Answer:</p>
                        <p className="text-gray-300 text-base leading-relaxed bg-gray-900/50 rounded-lg p-4">
                          {detail.answer || "No answer provided"}
                        </p>
                      </div>
                      
                      {detail.feedback && (
                        <div>
                          <p className="text-gray-400 text-sm font-medium mb-2">AI Feedback:</p>
                          <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-4">
                            <p className="text-amber-400 text-base leading-relaxed">{detail.feedback}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 text-center" style={fadeSlideInStyle("0.8s")}>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </main>

        <footer className="bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center text-gray-400">
              <p className="text-sm">© 2025 Prep Mind. All rights reserved.</p>
              <p className="text-xs mt-1">Made with ❤️ by Md Raza</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="w-full bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 shadow-lg sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
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
              <span className="text-emerald-400 text-sm font-medium">Q{currentIndex + 1}/5</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Debug info (hidden in production, remove if not needed) */}
          {debugInfo && (
            <div className="mb-4 p-2 bg-blue-600/20 border border-blue-600 rounded-lg text-blue-400 text-xs text-center">
              🔍 Debug: {debugInfo}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-400 text-center">
              ❌ {error}
            </div>
          )}
          
          {retryMessage && (
            <div className="mb-4 p-4 bg-yellow-600/20 border border-yellow-600 rounded-lg text-yellow-400 text-center">
              {retryMessage}
            </div>
          )}
          
          {isLoadingQuestions ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mb-4"></div>
              <p className="text-gray-300 text-lg font-medium">Preparing your interview questions...</p>
              <p className="text-gray-400 text-sm mt-2">This may take a few moments</p>
            </div>
          ) : questions.length !== 5 ? (
            <div className="text-center py-20">
              <p className="text-gray-300 text-lg">Expected 5 questions, found {questions.length}.</p>
              <p className="text-gray-400 text-sm mt-2">Please go back and try again.</p>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          ) : (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
              <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <button
                    onClick={handleReplayQuestion}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    disabled={isSpeaking}
                  >
                    <Volume2 size={16} className="text-white" />
                    <span className="text-white text-sm hidden sm:block">
                      {isSpeaking ? "Speaking..." : "Replay"}
                    </span>
                  </button>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

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

                <div className="space-y-4">
                  {currentIndex < 4 ? (
                    <>
                      <div className="flex justify-center">
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={!recognitionSupported}
                          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                            isRecording
                              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          } ${!recognitionSupported ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                          <span>{isRecording ? "Stop Recording" : "Answer with Voice"}</span>
                        </button>
                      </div>
                      
                      <textarea
                        readOnly
                        rows={4}
                        className="w-full p-4 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 resize-none cursor-default"
                        placeholder="Your voice answer will appear here..."
                        value={answerInput}
                      />
                    </>
                  ) : (
                    <textarea
                      rows={6}
                      className="w-full p-4 rounded-lg border border-gray-600 bg-gray-700/50 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      placeholder="Type your code solution here..."
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                    />
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
                  <button
                    onClick={handleSkip}
                    className="px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all"
                  >
                    Skip Question
                  </button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={handleNext}
                      disabled={!answerInput.trim()}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Question
                    </button>
                  ) : (
                    <button
                      onClick={handleEndTest}
                      disabled={!answerInput.trim() || isSubmitting}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      <footer className="bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p className="text-sm">© 2025 Prep Mind. All rights reserved.</p>
            <p className="text-xs mt-1">Made with ❤️ by Md Raza</p>
          </div>
        </div>
      </footer>
    </div>
  );
}