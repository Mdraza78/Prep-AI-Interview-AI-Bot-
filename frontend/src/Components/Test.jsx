import React, { useEffect, useState, useRef } from "react";
import { Bot, Mic, MicOff, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URLS } from "../config/api";

const BORDER_COLOR = "#238636";

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
  const codeBlockRegex = /``````/g;
  const parts = [];
  let lastIndex = 0,
    match,
    key = 0;

  while ((match = codeBlockRegex.exec(question)) !== null) {
    if (match.index > lastIndex) {
      const text = question.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push(
          <div
            key={`text-${key++}`}
            className="mb-2 text-base text-white whitespace-pre-wrap"
          >
            {text.trim()}
          </div>
        );
      }
    }
    const codeContent = match[1];
    parts.push(
      <div
        key={`code-${key++}`}
        className="my-4 rounded-xl bg-[#191f26] border-2 border-green-700 shadow-lg max-w-full overflow-auto"
      >
        <pre className="px-5 py-4 text-sm leading-snug text-green-100 font-mono whitespace-pre">
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
          className="mt-1 text-base text-white whitespace-pre-wrap"
        >
          {text.trim()}
        </div>
      );
    }
  }
  if (parts.length === 0) {
    return (
      <div className="text-base text-white whitespace-pre-wrap">{question}</div>
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

      // ✅ FIX: Capture ALL speech segments, not just first one
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
    try {
      const resumeText = localStorage.getItem("resumeText");
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
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setScore(data.score);
      setResultDetails(data.details || []);
    } catch (err) {
      console.error("Error submitting test:", err);
      alert("Error submitting test.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 bg-gradient-to-br from-[#0e1a23] via-[#1b2735] to-[#202935]">
      {/* Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-slide {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide { animation: fade-slide 0.6s cubic-bezier(.28,.84,.42,1) forwards; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 12px 3px ${BORDER_COLOR}88; }
          50% { box-shadow: 0 0 20px 5px ${BORDER_COLOR}cc; }
        }
        .animate-progress-pulse { animation: pulse-glow 2.5s infinite ease-in-out; }
      `}</style>

      {/* Header */}
      <header className="w-full bg-[#181f27] border-b-2 border-gray-500 shadow-lg" style={fadeSlideInStyle("0s")}>
        <div className="flex items-center justify-between max-w-5xl mx-auto py-7 px-6">
          <div className="flex items-center" style={fadeSlideInStyle("0.1s")}>
            <div
              className="w-14 h-14 bg-green-700 rounded-xl flex items-center justify-center"
              style={{ minWidth: 56, minHeight: 56 }}
            >
              <Bot size={32} className="text-white" />
            </div>
            <div className="ml-4">
              <h1 className="text-3xl font-bold text-white leading-tight">
                Prep Mind
              </h1>
              <div className="text-base text-gray-200 opacity-85 -mt-1">
                Smart Preparation
              </div>
            </div>
          </div>
          <div
            className="text-base font-normal text-white opacity-70"
            style={fadeSlideInStyle("0.2s")}
          >
            Hello, {userName}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center w-full py-8 px-2" style={fadeSlideInStyle("0.3s")}>
        <div
          className="w-full max-w-3xl rounded-2xl shadow-xl border border-solid border-green-700 px-10 sm:px-20 py-12 my-12"
          style={{
            backgroundColor: "#17212d",
            boxShadow:
              "0 8px 32px 0 rgba(22,101,52,0.15), 0 2px 7px 0 #131e2a80",
            ...fadeSlideInStyle("0.4s"),
          }}
        >
          {isLoadingQuestions ? (
            <div className="text-center py-32 text-lg text-green-700 font-semibold animate-pulse">
              Loading your interview…
            </div>
          ) : score !== null ? (
            <div className="text-center py-16" style={fadeSlideInStyle("0.5s")}>
              <h2 className="text-3xl font-semibold mb-4 text-white">
                Interview Complete!
              </h2>
              <div className="text-base font-normal mb-2 text-white">Your Score:</div>
              <div className="text-3xl font-semibold mb-10 text-white ">
                {score} / 100
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="px-8 py-2 rounded-full bg-green-700 text-green-100 font-medium shadow-lg transform hover:scale-105 hover:shadow-2xl active:scale-95 transition-transform duration-300 ease-in-out"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : questions.length !== 5 ? (
            <p className="text-center text-gray-100 font-normal text-base">
              Expected 5 questions, found {questions.length}.
            </p>
          ) : (
            <>
              {/* Progress bar */}
              <div
                className="relative w-full h-3 rounded-lg mb-6 overflow-hidden bg-[#1e293a] border border-green-700"
                style={fadeSlideInStyle("0.5s")}
              >
                <div
                  className="absolute left-0 top-0 h-full rounded transition-all duration-700 animate-progress-pulse"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    backgroundColor: BORDER_COLOR,
                    boxShadow: `0 0 15px 4px ${BORDER_COLOR}88`,
                  }}
                ></div>
              </div>

              {/* Question header */}
              <div
                className="flex items-center justify-between mb-3"
                style={fadeSlideInStyle("0.6s")}
              >
                <span className="uppercase tracking-wider font-medium text-base text-green-700">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <button
                  onClick={handleReplayQuestion}
                  className="p-1.5 rounded-full shadow transition bg-green-700 hover:bg-green-800 active:scale-90 focus:outline-none"
                  title="Replay Question"
                >
                  <Volume2 size={20} className="text-green-100" />
                </button>
              </div>

              {/* Question body */}
              <div className="mb-6" style={fadeSlideInStyle("0.7s")}>
                <QuestionDisplay question={questions[currentIndex]} />
                {isSpeaking && (
                  <span className="inline-block align-middle ml-3">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-bounce"></span>
                    <span className="inline-block w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:_0.12s]"></span>
                    <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:_0.22s]"></span>
                  </span>
                )}
              </div>

              {/* Answer input */}
              <div className="mb-2" style={fadeSlideInStyle("0.8s")}>
                {currentIndex < 4 ? (
                  <>
                    <div className="flex justify-center mb-2">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={!recognitionSupported}
                        className={`flex items-center gap-2 px-7 py-2 rounded-full font-normal shadow text-base transform transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 ${
                          isRecording
                            ? "bg-red-500 text-white"
                            : "bg-green-700 text-green-100"
                        } ${
                          !recognitionSupported
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {isRecording ? <MicOff size={17} /> : <Mic size={16} />}
                        {isRecording ? "Stop Recording" : "Answer Using Voice"}
                      </button>
                    </div>
                    <br />
                    <textarea
                      readOnly
                      rows={4}
                      className="block w-full p-3 rounded-lg border border-green-700 bg-[#181f27] text-green-100 font-normal resize-none shadow-inner"
                      placeholder={
                        recognitionSupported
                          ? "Your answer will appear here after speaking."
                          : "Voice input not supported in your browser"
                      }
                      value={answerInput}
                    />
                  </>
                ) : (
                  <textarea
                    rows={7}
                    className="block w-full p-3 rounded-lg border border-green-700 bg-[#181f27] text-green-100 font-normal resize-none shadow-inner"
                    placeholder="Please type your answer here"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                  />
                )}
              </div>

              {/* Buttons */}
              <div
                className="flex justify-center mt-7 space-x-6"
                style={fadeSlideInStyle("0.9s")}
              >
                <button
                  onClick={handleSkip}
                  className="w-36 py-3 rounded-lg font-semibold bg-green-700 text-white shadow hover:bg-green-800 active:scale-95 transition-transform duration-300 ease-in-out"
                >
                  Skip
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={handleNext}
                    disabled={answerInput.trim() === ""}
                    className="w-44 py-3 rounded-lg font-semibold border border-gray-600 text-gray-400 bg-transparent hover:bg-green-700 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition ease-in-out duration-300 active:scale-95"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleEndTest}
                    disabled={answerInput.trim() === "" || isSubmitting}
                    className="w-44 py-3 rounded-lg font-semibold border border-gray-600 text-gray-400 bg-transparent hover:bg-green-700 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition ease-in-out duration-300 active:scale-95"
                  >
                    {isSubmitting ? "Submitting..." : "Finish Test"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full bg-[#181f27] border-t- border-gray-500 py-4 mt-4"
        style={fadeSlideInStyle("1s")}
      >
        <div className="text-center text-green-700 font-medium tracking-wide text-base">
          © 2025 Prep Mind.
          <span className="text-gray-400"> All rights reserved. </span>
          <span className="text-xs text-gray-500 block mt-1">
            Made with ❤️ by Md Raza.
          </span>
        </div>
      </footer>
    </div>
  );
}