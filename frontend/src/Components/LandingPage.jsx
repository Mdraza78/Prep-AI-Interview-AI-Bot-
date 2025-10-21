import React, { useEffect, useRef, useState } from "react";
import { Bot, Upload, Mic, Trophy, TrendingUp } from "lucide-react";
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
      className={`bg-gray-800 border border-gray-700 rounded-2xl p-4 sm:p-6 flex flex-col items-start gap-3 
      transition-transform duration-500 ease-in-out hover:scale-105 w-full max-w-sm mx-auto ${extraClass}`}
    >
      <div className="bg-gray-900 p-2 sm:p-3 rounded-md mb-1 sm:mb-2">{icon}</div>
      <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  const cardsData = [
    {
      icon: <Upload size={24} className="text-green-500 sm:w-8 sm:h-8" />,
      title: "Upload Resume",
      description:
        "Upload your resume and let our AI analyze your skills and experience to generate personalized interview questions.",
    },
    {
      icon: <Mic size={24} className="text-green-500 sm:w-8 sm:h-8" />,
      title: "Voice Interview Practice",
      description:
        "Practice answering AI-generated questions using your voice for a realistic interview simulation.",
    },
    {
      icon: <TrendingUp size={24} className="text-green-500 sm:w-8 sm:h-8" />,
      title: "Performance Analytics",
      description:
        "Track your progress with detailed scoring and AI-powered feedback to improve continuously.",
    },
    {
      icon: <Trophy size={24} className="text-green-500 sm:w-8 sm:h-8" />,
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
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans overflow-x-hidden">
      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          0% { opacity: 0; transform: translateY(1rem); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header - Fixed for mobile */}
      
<header className="w-full bg-gray-900 border-b border-gray-800 p-3 sm:p-4 flex 
items-center justify-between sticky top-0 z-50">
  <div className="flex items-center gap-2 sm:gap-3" style={fadeSlideInStyle("0.05s")}>
    <div className="bg-green-600 rounded-md p-1 sm:p-2">
      <Bot size={28} className="text-white sm:w-9 sm:h-9" />
    </div>
    <div className="flex flex-col">
      <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Prep Mind</h1>
      <p className="text-gray-400 text-xs sm:text-xs">Smart Preparation</p> {/* Changed this line */}
    </div>
  </div>

  <button
    onClick={() => navigate("/register")}
    className="px-4 py-2 sm:px-6 sm:py-2 rounded-md font-semibold bg-green-600
    text-white hover:bg-green-700 transition-all duration-300 ease-in-out
    transform hover:scale-105 text-sm sm:text-base whitespace-nowrap"
  >
    Get Started
  </button>
</header>

      {/* Main Content */}
      <main className="flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12 gap-12 sm:gap-16 flex-1">

{/* Hero Section */}
<div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-16 w-full max-w-6xl mt-12 sm:mt-16">
  {/* Text Content */}
  <div
    className="flex flex-col text-center lg:text-left w-full lg:w-1/2 pt-6 sm:pt-0"
    style={fadeSlideInStyle("0.25s")}
  >
    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-white mb-4 sm:mb-6">
      Master Your Interview Skills with{" "}
      <span className="text-green-500">Prep-Mind</span>
    </h1>
    <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8 max-w-2xl mx-auto lg:mx-0">
      Transform your interview preparation with our AI-powered platform. Upload your resume to receive personalized question sets tailored to your experience. 
      Practice with realistic voice-based simulations, receive instant AI feedback on your responses, and track your progress with detailed analytics. 
      Join thousands of professionals who have boosted their confidence and success rates with Prep-Mind's comprehensive interview coaching system.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
      <button
        onClick={() => navigate("/login")}
        className="px-6 py-3 sm:px-8 sm:py-3 rounded-md font-semibold bg-green-600 text-white
        hover:bg-green-700 transition-all duration-300 ease-in-out transform
        hover:scale-105 text-base sm:text-lg w-full sm:w-auto"
      >
        Start Practicing Now
      </button>
    </div>
  </div>

  {/* Image */}
  <div className="flex-shrink-0 w-full lg:w-1/2 max-w-md" style={fadeSlideInStyle("0.35s")}>
    <img
      src="https://static.vecteezy.com/system/resources/thumbnails/044/278/766/small_2x/cute-ai-robot-chatbot-on-isolated-transparent-background-png.png"
      alt="AI Robot"
      className="w-full h-auto rounded-xl transition-transform
      duration-300 ease-in-out hover:scale-105"
    />
  </div>
</div>

        {/* Section Heading */}
        <div
          ref={sectionHeadingRef}
          className="max-w-4xl text-center mx-auto mb-8 transition-all duration-700 w-full px-4"
        >
          <h2
            className={`text-2xl sm:text-3xl font-bold text-white mb-3 transition-all duration-700 ${
              headingVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-10 sm:-translate-x-20"
            }`}
          >
            Complete Interview Preparation Platform
          </h2>
          <p
            className={`text-gray-400 text-base sm:text-lg max-w-xl mx-auto transition-all duration-700 delay-200 ${
              headingVisible
                ? "opacity-100 translate-x-0"
                : "opacity-0 -translate-x-10 sm:-translate-x-20"
            }`}
          >
            Everything you need to succeed in your next interview, powered by advanced AI technology
          </p>
        </div>

        {/* Features Grid */}
        <div className="w-full max-w-6xl px-4" ref={cardsRef}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {cardsData.map((card, idx) => (
              <FeatureCard
                key={idx}
                icon={card.icon}
                title={card.title}
                description={card.description}
                extraClass={
                  `transition-all duration-700 ` +
                  (cardsVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 sm:-translate-x-20") +
                  (idx === 0
                    ? " delay-200"
                    : idx === 1
                    ? " delay-300"
                    : idx === 2
                    ? " delay-400"
                    : " delay-500")
                }
              />
            ))}
          </div>
        </div>

        {/* How It Works Section */}
        {/* How It Works Section */}
<div ref={howItWorksRef} className="max-w-6xl w-full px-4 mt-12 sm:mt-20 flex flex-col items-center">
  <h2
    className={`text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 text-center transition-all duration-700 ${
      hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 sm:-translate-x-20"
    }`}
  >
    How Prep Mind Works
  </h2>
  <p
    className={`text-gray-300 text-sm sm:text-base text-center mb-8 sm:mb-10 max-w-xl transition-all duration-700 delay-200 ${
      hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 sm:-translate-x-20"
    }`}
  >
    Simple, effective, and results-driven approach to interview preparation
  </p>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full">
    <div className={`flex flex-col items-center text-center px-4 transition-all duration-700 delay-300 ${
      hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 sm:-translate-x-20"
    }`}>
      <div className="bg-green-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full flex
      items-center justify-center mb-4 text-xl sm:text-2xl font-bold shadow-md">
        1
      </div>
      <h3 className="font-semibold text-lg text-white mb-2">Upload Your Resume</h3>
      <p className="text-gray-400 text-sm leading-relaxed">
        Upload your resume in PDF format. Our AI analyzes your experience and skills to create personalized questions.
      </p>
    </div>

    <div className={`flex flex-col items-center text-center px-4 transition-all duration-700 delay-600 ${
      hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 sm:-translate-x-20"
    }`}>
      <div className="bg-green-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full flex
      items-center justify-center mb-4 text-xl sm:text-2xl font-bold shadow-md">
        2
      </div>
      <h3 className="font-semibold text-lg text-white mb-2">Practice with Voice</h3>
      <p className="text-gray-400 text-sm leading-relaxed">
        Answer AI-generated questions using your voice. Experience realistic interview scenarios with instant feedback.
        <span className="block mt-2 text-green-400 text-xs font-medium">
          🎤 Professional microphone or earphones recommended for best audio quality
        </span>
      </p>
    </div>

    <div className={`flex flex-col items-center text-center px-4 transition-all duration-700 delay-900 ${
      hiwVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10 sm:-translate-x-20"
    }`}>
      <div className="bg-green-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full flex
      items-center justify-center mb-4 text-xl sm:text-2xl font-bold shadow-md">
        3
      </div>
      <h3 className="font-semibold text-lg text-white mb-2">Track & Improve</h3>
      <p className="text-gray-400 text-sm leading-relaxed">
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