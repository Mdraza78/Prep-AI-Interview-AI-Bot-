import React, { useState } from 'react';
import axios from 'axios';
import {
  User,
  Mail,
  Lock,
  FileText,
  CheckCircle,
  XCircle,
  Bot,
  UserCheck,
  Phone,
  Feather,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Main App component wrapping the Registration form
export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <RegisterForm onRegisterSuccess={() => console.log('Registration successful!')} />
    </div>
  );
}

function RegisterForm({ onRegisterSuccess }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    bio: '',
    skills: '',
    email: '',
    password: '',
  });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const bioWordLimit = 20;

  // Calculate current bio word count (ignores extra spaces)
  const bioWordCount = form.bio.trim() === '' ? 0 : form.bio.trim().split(/\s+/).length;

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Prevent bio word count from exceeding limit
    if (name === 'bio') {
      const words = value.trim().split(/\s+/);
      if (words.length > bioWordLimit) return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check bio word count
    if (bioWordCount > bioWordLimit) {
      setError(`Bio cannot exceed ${bioWordLimit} words.`);
      setMsg('');
      return;
    }

    setError('');
    setMsg('');
    setLoading(true);

    try {
      // Combine firstName and lastName into one full name
      const postData = {
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        skills: form.skills.trim(),
        email: form.email.trim(),
        password: form.password,
      };

      const res = await axios.post('http://localhost:5000/api/user/register', postData);

      setMsg(res.data.msg || 'Registration successful!');
      setForm({
        firstName: '',
        lastName: '',
        phone: '',
        bio: '',
        skills: '',
        email: '',
        password: '',
      });

      if (onRegisterSuccess) onRegisterSuccess();
    } catch (err) {
      setMsg('');
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 max-w-xl w-full">
  <div className="w-full bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
        {/* Header and Logo */}
        <div className="flex flex-col items-center space-y-2">
          <div className="bg-green-600 rounded-full p-2 relative">
            <Bot size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-white">Interview AI</h2>
          <p className="text-sm text-gray-400 text-center">
            Create your account and start your Interview preparation with Interview AI
          </p>
        </div>

        {/* Alert messages */}
        {(msg || error) && (
          <div
            className={`p-3 rounded-xl flex items-center gap-2 ${
              msg ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
            }`}
            role="alert"
          >
            {msg ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <span className="text-sm font-medium">{msg || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First and Last Name */}
          <div className="flex gap-4">
            <div className="space-y-1 flex-1">
              <label className="text-gray-300 text-sm font-medium">First Name</label>
              <div className="relative">
                <input
                  type="text"
                  name="firstName"
                  placeholder="Enter your first name"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border-none rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserCheck size={20} className="text-gray-400" />
                </div>
              </div>
            </div>

            <div className="space-y-1 flex-1">
              <label className="text-gray-300 text-sm font-medium">Last Name</label>
              <div className="relative">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Enter your last name"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border-none rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={20} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Phone Number</label>
            <div className="relative">
              <input
                type="tel"
                name="phone"
                placeholder="Enter your phone number"
                value={form.phone}
                onChange={handleChange}
                pattern="^[+]?[\d\s\-]{7,15}$"
                title="Enter a valid phone number (7-15 digits, optional +)"
                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border-none rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone size={20} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Bio <span className="text-gray-400 text-xs">(max {bioWordLimit} words)</span></label>
            <textarea
              name="bio"
              placeholder="Write a short bio (max 20 words)"
              rows={3}
              value={form.bio}
              onChange={handleChange}
              className="w-full p-3 resize-none rounded-xl bg-gray-700 text-white border-none focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
            />
            <div className="text-xs text-gray-400 text-right">
              {bioWordCount} / {bioWordLimit} words
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Skills (comma separated)</label>
            <div className="relative">
              <input
                type="text"
                name="skills"
                placeholder="e.g. JavaScript, Python, Machine Learning"
                value={form.skills}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border-none rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Feather size={20} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Email Address</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border-none rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={20} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type="password"
                name="password"
                placeholder="Create a strong password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 bg-gray-700 text-white border-none rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={20} className="text-gray-400" />
              </div>
            </div>
          </div>
          <br />
          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:bg-green-400 disabled:cursor-not-allowed"
          >
          
            {loading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <>
                <FileText size={20} />
                Create Account
              </>
            )}
          </button>
      

          <p className="text-sm text-gray-400 text-center mt-4">
            Already have an account?{' '}
            <b>
              <Link to="/login" className="text-green-500 hover:underline">
                Login
              </Link>
            </b>
          </p>
        </form>
      </div>

      {/* Feature Icons Section */}
      <div className="w-full mt-4 pt-4 border-t border-gray-700 flex justify-around text-center">
        <div className="flex flex-col items-center">
          <Bot size={24} className="text-green-500" />
          <span className="text-xs text-gray-400 mt-1">AI-Powered</span>
        </div>
        <div className="flex flex-col items-center">
          <FileText size={24} className="text-green-500" />
          <span className="text-xs text-gray-400 mt-1">PDF Resume Upload</span>
        </div>
        <div className="flex flex-col items-center">
          <UserCheck size={24} className="text-green-500" />
          <span className="text-xs text-gray-400 mt-1">Personalized</span>
        </div>
      </div>
    </div>
  );
}
