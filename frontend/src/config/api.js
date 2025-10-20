const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const API_URLS = {
  BASE: API_BASE_URL,
  REGISTER: `${API_BASE_URL}/api/user/register`,
  LOGIN: `${API_BASE_URL}/api/user/login`,
  UPLOAD_RESUME: `${API_BASE_URL}/api/user/upload-resume`,
  PROFILE: `${API_BASE_URL}/api/user/profile`,
  START_INTERVIEW: `${API_BASE_URL}/api/user/start-interview`,
  EVALUATE_TEST: `${API_BASE_URL}/api/user/evaluate-test`,
  RESULTS: `${API_BASE_URL}/api/user/results`,
  LEADERBOARD: `${API_BASE_URL}/api/user/leaderboard`,
};

export default API_BASE_URL;