import React, { useEffect, useRef, useState } from "react";
import { Bot, Upload, Mic, Trophy, TrendingUp} from "lucide-react";
import Footer from "./Footer";
import { useNavigate } from "react-router-dom";

// Animation helper for hero (fade from bottom)
const fadeSlideInStyle = (delay = "0s") => ({
  animation: `fadeSlideIn 0.7s ease-out forwards`,
  animationDelay: delay,
  opacity: 0,
  transform: "translateY(1rem)",
});

// Feature Card Component
function FeatureCard({ icon, title, description, extraClass = "" }) {
  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-2xl p-6 flex flex-col items-start gap-3 
      transition-transform duration-500 ease-in-out hover:scale-105 max-w-lg mx-auto ${extraClass}`}
    >
      <div className="bg-gray-900 p-3 rounded-md mb-2">{icon}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  const cardsData = [
    {
      icon: <Upload size={32} className="text-green-500" />,
      title: "Upload Resume",
      description:
        "Upload your resume and let our AI analyze your skills and experience to generate personalized interview questions.",
    },
    {
      icon: <Mic size={32} className="text-green-500" />,
      title: "Voice Interview Practice",
      description:
        "Practice answering AI-generated questions using your voice for a realistic interview simulation.",
    },
    {
      icon: <TrendingUp size={32} className="text-green-500" />,
      title: "Performance Analytics",
      description:
        "Track your progress with detailed scoring and AI-powered feedback to improve continuously.",
    },
    {
      icon: <Trophy size={32} className="text-green-500" />,
      title: "Global Leaderboard",
      description:
        "Compete with others worldwide and showcase your interview skills on the global leaderboard.",
    },
  ];

  // Intersection Observer states
  const sectionHeadingRef = useRef(null);
  const cardsRef = useRef(null);
  const howItWorksRef = useRef(null);

  const [headingVisible, setHeadingVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [hiwVisible, setHiwVisible] = useState(false);

  // Observer for heading
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHeadingVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.2 });

    if (sectionHeadingRef.current) obs.observe(sectionHeadingRef.current);
    return () => obs.disconnect();
  }, []);

  // Observer for cards
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setCardsVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.15 });

    if (cardsRef.current) obs.observe(cardsRef.current);
    return () => obs.disconnect();
  }, []);

  // Observer for How It Works
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHiwVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.2 });

    if (howItWorksRef.current) obs.observe(howItWorksRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans">
      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <header className="w-full bg-gray-900 border-b border-gray-800 p-4 flex 
      items-center justify-between max-w-7xl mx-auto px-12 sm:px-16">

        <div className="flex flex-col items-start gap-1 ml-6" style={fadeSlideInStyle("0.05s")}>
          <div className="flex items-center gap-2">
            <div className="bg-green-600 rounded-md p-2">
              <Bot size={36} className="text-white" />
            </div>
            <div className="ml-1">
              <h1 className="text-2xl font-bold text-white mb-0">Prep Mind</h1>
              <p className="text-gray-400 text-xs">Smart Preparation</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate("/register")}
          className="mr-6 px-6 py-2 rounded-md font-semibold bg-green-600
          text-white hover:bg-green-800 transition-all duration-700 ease-in-out
          transform hover:scale-110 hover:-translate-y-[2px] text-base"
       
        >
          Get Started
        </button>
      </header>

      {/* Main */}
      <main className="flex flex-col items-center px-6 py-12 max-w-7xl mx-auto gap-16">

        {/* Hero */}
        <div className="flex flex-col md:flex-row items-center gap-16 w-full">
          {/* Text */}
          <div
            className="flex flex-col max-w-xl text-left md:ml-auto md:mr-12"
            style={fadeSlideInStyle("0.25s")}
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium leading-snug text-white mb-4">
              Master Your Interview Skills with{" "}
              <span className="text-green-500 font-semibold">Prep-Mind</span>
            </h1>
            <br />
            <p className="text-gray-400 text-base sm:text-lg font-normal leading-tight max-w-[30rem] mb-8">
              Upload your resume, practice with AI-generated questions, and track your
              progress. Prep Mind helps you ace your interviews with personalized feedback
              and realistic practice sessions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate("/login")}
                className="px-7 py-3 rounded-md font-semibold bg-green-600 text-white
                hover:bg-green-700 transition-all duration-500 ease-in-out transform
                hover:scale-105 hover:-translate-y-[2px] text-base"
              >
                Start Practicing Now
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-shrink-0 max-w-md" style={fadeSlideInStyle("0.35s")}>
            <img
              src="https://static.vecteezy.com/system/resources/thumbnails/044/278/766/small_2x/cute-ai-robot-chatbot-on-isolated-transparent-background-png.png"
              alt="AI Robot"
              className="w-full h-auto rounded-xl transition-transform
              duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-105 hover:-translate-y-1"
            />
          </div>
        </div>

        {/* Section Heading before cards with left→right animation */}
        <div
          ref={sectionHeadingRef}
          className="max-w-4xl text-center mx-auto mb-8 transition-all duration-700"
        >
          <h2
            className={`text-3xl font-bold text-white mb-3 transition-all duration-700 ${
              headingVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-20"
            }`}
          >
            Complete Interview Preparation Platform
          </h2>
          <p
            className={`text-gray-400 text-lg max-w-xl mx-auto transition-all duration-700 delay-200 ${
              headingVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-20"
            }`}
          >
            Everything you need to succeed in your next interview, powered by advanced AI technology
          </p>
        </div>

        {/* Cards */}
        <div className="w-full flex justify-center" ref={cardsRef}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10">
            {cardsData.map((card, idx) => (
              <FeatureCard
                key={idx}
                icon={card.icon}
                title={card.title}
                description={card.description}
                extraClass={
                  `transition-all duration-700 ` +
                  (cardsVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20") +
                  (idx === 0
                    ? " delay-200"
                    : idx === 1
                    ? " delay-400"
                    : idx === 2
                    ? " delay-600"
                    : " delay-800")
                }
              />
            ))}
          </div>
        </div>

        {/* How Prep Mind Works */}
        <div ref={howItWorksRef} className="max-w-5xl w-full mx-auto mt-20 flex flex-col items-center">
          <h2
            className={`text-2xl md:text-3xl font-bold text-white mb-3 text-center transition-all duration-700 ${
              hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            How Prep Mind Works
          </h2>
          <p
            className={`text-gray-300 text-sm md:text-base text-center mb-10 max-w-xl transition-all duration-700 delay-200 ${
              hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}
          >
            Simple, effective, and results-driven approach to interview preparation
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 gap-x-8 w-full">
            <div className={`flex flex-col items-center text-center px-4 transition-all duration-700 delay-300 ${
              hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}>
              <div className="bg-green-600 text-white w-14 h-14 rounded-full flex
              items-center justify-center mb-5 text-2xl font-bold shadow-md">
                1
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Upload Your Resume</h3>
              <p className="text-gray-400 text-sm text-justify">
                Upload your resume in PDF format. Our AI analyzes your experience and skills to create personalized questions.
              </p>
            </div>

            <div className={`flex flex-col items-center text-center px-4 transition-all duration-700 delay-600 ${
              hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}>
              <div className="bg-green-600 text-white w-14 h-14 rounded-full flex
              items-center justify-center mb-5 text-2xl font-bold shadow-md">
                2
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Practice with Voice</h3>
              <p className="text-gray-400 text-sm text-justify">
                Answer AI-generated questions using your voice. Experience realistic interview scenarios with instant feedback.
              </p>
            </div>

            <div className={`flex flex-col items-center text-center px-4 transition-all duration-700 delay-900 ${
              hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
            }`}>
              <div className="bg-green-600 text-white w-14 h-14 rounded-full flex
              items-center justify-center mb-5 text-2xl font-bold shadow-md">
                3
              </div>
              <h3 className="font-semibold text-lg text-white mb-2">Track & Improve</h3>
              <p className="text-gray-400 text-sm text-justify">
                View detailed scores, get improvement suggestions, and climb the leaderboard to showcase your skills.
              </p>
            </div>
          </div>
        </div>
      </main>

     {/* Footer */}
        <Footer />


    </div>
  );
}
