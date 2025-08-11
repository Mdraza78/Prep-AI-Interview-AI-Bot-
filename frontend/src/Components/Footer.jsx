import { Bot } from "lucide-react";

// Custom GitHub icon
const GithubIcon = ({ size = 24, className = "" }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    width={size}
    height={size}
    className={className}
  >
    <title>GitHub</title>
    <path d="M12 0C5.37 0 0 5.373 0 12a12 12 0 008.205 11.385c.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.386-1.333-1.756-1.333-1.756-1.09-.745.08-.73.08-.73 1.204.084 1.84 1.237 1.84 1.237 1.07 1.832 2.807 1.303 3.492.997.11-.776.418-1.304.76-1.605-2.665-.303-5.466-1.33-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.123-.303-.535-1.523.117-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 013.003-.404c1.018.005 2.045.138 3.003.404 2.28-1.552 3.285-1.23 3.285-1.23.658 1.653.247 2.873.12 3.176.77.84 1.23 1.91 1.23 3.22 0 4.61-2.807 5.624-5.48 5.922.43.372.815 1.102.815 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.215.694.825.576A12.005 12.005 0 0024 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

// Custom LinkedIn icon
const LinkedinIcon = ({ size = 24, className = "" }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    width={size}
    height={size}
    className={className}
  >
    <title>LinkedIn</title>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.327-.027-3.037-1.851-3.037-1.854 0-2.136 1.447-2.136 2.941v5.665h-3.554v-11.45h3.413v1.561h.049c.475-.899 1.637-1.85 3.369-1.85 3.602 0 4.267 2.371 4.267 5.455v6.284zm-14.284-13.03c-1.144 0-2.072-.927-2.072-2.07 0-1.144.928-2.072 2.072-2.072s2.07.928 2.07 2.072c0 1.143-.926 2.07-2.07 2.07zm1.777 13.03h-3.554v-11.45h3.554v11.45zm16.06-20.452h-20.221c-1.105 0-2 .896-2 2v20.448c0 1.103.895 2 2 2h20.221c1.104 0 2-.897 2-2v-20.45c0-1.104-.896-2-2-2z"/>
  </svg>
);

// Custom Instagram icon
const InstagramIcon = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    stroke="currentColor"
    fill="none"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-gray-800 border-t border-gray-700 mt-20">
      <div className="max-w-7xl mx-auto px-6 pt-8 flex flex-col md:flex-row justify-between items-center">
        {/* Logo and tagline */}
        <div className="flex flex-col items-start">
          <div className="flex items-center mb-2">
            <div className="bg-green-600 p-2 rounded-md">
              <Bot size={28} className="text-white" />
            </div>
            <span className="ml-2 text-lg font-bold text-white">Prep Mind</span>
          </div>
          <p className="text-gray-400 text-sm mb-1">
            Smart AI-powered platform to help you ace interviews and land your dream job.
          </p>
        </div>

        {/* Follow Me On */}
        <div className="flex flex-col md:items-end items-center mt-8 md:mt-0">
          <h4 className="text-white font-semibold mb-4">Follow Me On</h4> {/* increased margin-bottom */}
          <div className="flex space-x-4">
            <a href="https://github.com/Mdraza78" className="text-gray-400 hover:text-green-500 transition-colors" aria-label="GitHub">
              <GithubIcon size={24} />
            </a>
            <a href="https://www.instagram.com/raza_sheikh78601/" className="text-gray-400 hover:text-green-500 transition-colors" aria-label="Instagram">
              <InstagramIcon size={24} />
            </a>
            <a href="https://www.linkedin.com/in/md-raza-5607a3244/" className="text-gray-400 hover:text-green-500 transition-colors" aria-label="LinkedIn">
              <LinkedinIcon size={24} />
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="mt-10 pb-6 text-center text-gray-400 text-sm">
        © 2025 Prep Mind. All rights reserved.&nbsp;
        Made with <span className="text-red-400">❤️</span> by Md Raza.
      </div>
    </footer>
  );
}
