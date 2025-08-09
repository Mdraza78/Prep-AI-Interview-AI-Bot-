import React, { useState, useEffect, useRef } from "react";
import { Bot, Mic, MicOff, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BORDER_COLOR = "#238636"; // lighter green (Tailwind green-700)
const token = localStorage.getItem("token"); // token from login
// Component to render question text with code blocks
function QuestionDisplay({ question }) {
  // Correct regex for triple backticks
  const codeBlockRegex = /``````/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = codeBlockRegex.exec(question)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      const textBefore = question.slice(lastIndex, matchIndex).trim();
      if (textBefore) {
        nodes.push(
          <div key={`text-${key++}`} className="mb-2 text-base text-white whitespace-pre-wrap">
            {textBefore}
          </div>
        );
      }
    }
    const codeContent = match[1];
    nodes.push(
      <div
        key={`code-block-${key++}`}
        className="my-4 rounded-xl bg-[#191f26] border-2 border-green-700 shadow-lg max-w-full overflow-auto"
      >
        <pre className="px-5 py-4 text-sm leading-snug text-green-100 font-mono whitespace-pre">
          <code>{codeContent}</code>
        </pre>
      </div>
    );
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < question.length) {
    const textAfter = question.slice(lastIndex).trim();
    if (textAfter) {
      nodes.push(
        <div key={`text-end`} className="mt-1 text-base text-white whitespace-pre-wrap">
          {textAfter}
        </div>
      );
    }
  }

  if (nodes.length === 0) {
    return <div className="text-base text-white whitespace-pre-wrap">{question}</div>;
  }
  return <>{nodes}</>;
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
  const [resultDetails, setResultDetails] = useState([]); // Optional feedback

  const userName = localStorage.getItem("name") || "User";
  const navigate = useNavigate();
  const recognitionRef = useRef(null);

  useEffect(() => {
    async function fetchQuestions() {
      setIsLoadingQuestions(true);
      try {
        const resumeText = localStorage.getItem("resumeText");
        if (!resumeText) {
          alert("No resume text found. Please upload your resume first.");
          navigate("/");
          return;
        }
        const res = await fetch("http://localhost:5000/api/user/start-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        });
        const data = await res.json();
        if (data.questions && data.questions.length === 5) {
          setQuestions(data.questions);
          setAnswers(Array(data.questions.length).fill(""));
          setAnswerInput("");
          speakText(data.questions[0]);
        } else {
          alert("Unexpected number of questions received. Expected 5.");
        }
      } catch {
        alert("Error fetching questions!");
      } finally {
        setIsLoadingQuestions(false);
      }
    }
    fetchQuestions();
    // eslint-disable-next-line
  }, []);

  function speakText(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.rate = 0.97;
    setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  const startRecording = () => {
    if (currentIndex === 4) {
      alert("For the coding question, please type your answer.");
      return;
    }
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Your browser does not support voice input.");
      return;
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript || "";
      }
      setAnswerInput(transcript || "");
    };
    recognition.onerror = (event) => {
      alert(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
      recognition.stop();
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
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
    temp[currentIndex] = ""; // skipped
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
    const res = await fetch("http://localhost:5000/api/user/evaluate-test", {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}` // ✅ add token here
  },
  body: JSON.stringify({ resumeText, questions, answers: temp }),
});

      const data = await res.json();
      if (data.score !== undefined) setScore(data.score);
      if (data.details) setResultDetails(data.details);
      else setResultDetails([]);
    } catch {
      alert("Error submitting test.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0e1a23] via-[#1b2735] to-[#202935]">
      {/* Header */}
      <header className="w-full bg-[#181f27] border-b-2 border-green-700 shadow-lg">
        <div className="flex items-center justify-between max-w-5xl mx-auto py-7 px-6">
          <div className="flex items-center gap-4">
            <Bot size={44} className="text-green-700" />
            <h1 className="text-2xl font-semibold tracking-wide text-white">
              Prep Mind Interview
            </h1>
          </div>
          <div className="text-base font-normal text-white opacity-70">
            Hello, {userName}
          </div>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center w-full py-8 px-2">
        <div
          className="w-full max-w-3xl rounded-2xl shadow-xl border border-solid border-green-700 px-10 sm:px-20 py-12 my-12 animate-fade-slide"
          style={{
            backgroundColor: "#17212d",
            boxShadow: "0 8px 32px 0 rgba(22,101,52,0.15), 0 2px 7px 0 #131e2a80",
          }}
        >
          {isLoadingQuestions ? (
            <div className="text-center py-32 text-lg text-green-700 font-semibold animate-pulse">
              Loading your interview…
            </div>
          ) : score !== null ? (
            <div className="text-center py-16">
              <h2 className="text-3xl font-semibold mb-4 text-green-700">
                Interview Complete!
              </h2>
              <div className="text-base font-normal text-green-400 mb-2">
                Your Score:
              </div>
              <div className="text-5xl font-semibold mb-10 text-green-700">
                {score} / 100
              </div>

              {/* Per-question feedback */}
              {resultDetails.length > 0 && (
                <div className="my-8 text-left">
                  <h3 className="text-xl text-green-700 mb-3">
                    Per-Question Feedback:
                  </h3>
                  {resultDetails.map((item, idx) => (
                    <div
                      key={idx}
                      className="mb-6 bg-[#181f27] rounded-xl border border-green-700 p-5"
                    >
                      <div className="text-green-300 font-bold mb-1">
                        Question {idx + 1}:
                      </div>
                      <div className="text-green-100 mb-2">{item.question}</div>
                      <div className="text-green-500 mb-2">
                        Your answer:{" "}
                        <span className="text-green-200">{item.answer}</span>
                      </div>
                      <div className="mb-2 text-white font-bold">
                        Score:{" "}
                        <span className="text-green-400 font-semibold">
                          {item.individualScore} / 20
                        </span>
                      </div>
                      {item.feedback && (
                        <div className="text-green-300">Feedback: {item.feedback}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

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
              <div className="relative w-full h-3 rounded-lg mb-6 overflow-hidden bg-[#1e293a] border border-green-700">
                <div
                  className="absolute left-0 top-0 h-full rounded transition-all duration-700 animate-progress-pulse"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    backgroundColor: BORDER_COLOR,
                    boxShadow: `0 0 15px 4px ${BORDER_COLOR}88`,
                  }}
                ></div>
              </div>

              <div className="flex items-center justify-between mb-3">
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

              {/* Question and display */}
              <div className="mb-6">
                <QuestionDisplay question={questions[currentIndex]} />
                {isSpeaking && (
                  <span className="inline-block align-middle ml-3">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-bounce"></span>
                    <span className="inline-block w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:_0.12s]"></span>
                    <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:_0.22s]"></span>
                  </span>
                )}
              </div>
              <div className="mb-2">
                {currentIndex < 4 ? (
                  <>
                  
                    <div className="flex justify-center mb-2">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`flex items-center gap-2 px-7 py-2 rounded-full font-normal shadow text-base transform transition-transform duration-300 ease-in-out hover:scale-105 hover:shadow-lg active:scale-95 ${
                          isRecording ? "bg-red-500 text-white" : "bg-green-700 text-green-100"
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
                      placeholder="Your answer will appear here after speaking."
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

              <div className="flex justify-center mt-7 space-x-6">
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
      <footer className="w-full bg-[#181f27] border-t-2 border-green-700 py-4 mt-4">
        <div className="text-center text-green-700 font-medium tracking-wide text-base">
          © 2025 Prep Mind.
          <span className="text-gray-400"> All rights reserved. </span>
          <span className="text-xs text-gray-500 block mt-1">Made with ❤️ by Md Raza.</span>
        </div>
      </footer>

      {/* Animations */}
      <style>{`
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
    </div>
  );
}
