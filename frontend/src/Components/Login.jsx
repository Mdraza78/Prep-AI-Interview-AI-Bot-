import React, { useState } from 'react';
import axios from 'axios';
import {
  Mail,
  Lock,
  CheckCircle,
  XCircle,
  Bot,
  FileText as FileTextIcon,
  UserCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login({ onLoginSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

 // In your Login.jsx handleSubmit function:
const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setMsg('');
  setLoading(true);

  try {
    const res = await axios.post('http://localhost:5000/api/user/login', form);
    // Clear any existing data first
    localStorage.clear();
    
    // Store new data
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('userId', res.data.userId);
    localStorage.setItem('name', res.data.name);
    
    setMsg('Login successful!');
    if (onLoginSuccess) onLoginSuccess(res.data.name);
    navigate('/dashboard');
  } catch (err) {
    setError(err.response?.data?.error || 'Login failed');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* Form Card */}
      <div className="w-full max-w-lg bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center space-y-2">
          {/* Logo */}
          <div className="bg-green-600 rounded-full p-2 relative">
            <Bot size={48} className="text-white" />
          </div>

          <h2 className="text-3xl font-extrabold text-white">Interview AI</h2>
          <p className="text-sm text-gray-400 text-center">
            Login to access AI-powered interview preparation
          </p>
        </div>

        {/* Message Alerts */}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
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

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-gray-300 text-sm font-medium">Password</label>
            <div className="relative">
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
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

          {/* Submit Button */}
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
              'Login'
            )}
          </button>

          <br />

          <p className="text-sm text-gray-400 text-center mt-4">
            Don't have an account?{' '}
            <b>
              <Link to="/register" className="text-green-500 hover:underline">
                Create Account
              </Link>
            </b>
          </p>
        </form>
      </div>
            <br/>
      {/* Feature Icons below the form box with matching width */}
      <div className="w-full max-w-lg mt-4 pt-4 border-t border-gray-700 flex justify-around text-center">
        <div className="flex flex-col items-center">
          <Bot size={24} className="text-green-500" />
          <span className="text-xs text-gray-400 mt-1">AI-Powered</span>
        </div>
        <div className="flex flex-col items-center">
          <FileTextIcon size={24} className="text-green-500" />
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
