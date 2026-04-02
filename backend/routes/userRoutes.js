const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const fetch = require('node-fetch');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Enhanced logging function
function logWithTimestamp(...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

async function callGeminiAPI(prompt, isJsonResponse = false, retryCount = 0, maxRetries = 3) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

// Use the stable versioned model
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const requestBody = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    maxOutputTokens: 1500,
    temperature: 0.7,
    responseMimeType: isJsonResponse ? "application/json" : "text/plain"
  }
};

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // 1. Check if the API returned an error object
    if (data.error) {
      console.error("Gemini API Error Details:", data.error);
      throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    // 2. Safely check if candidates exist before accessing [0]
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error("Unexpected API Structure:", JSON.stringify(data));
      throw new Error("Invalid response structure from Gemini");
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    // Handle Rate Limiting (429)
    if (error.message.includes('429') && retryCount < maxRetries) {
      const delay = Math.min(2000 * Math.pow(2, retryCount), 10000);
      await new Promise(res => setTimeout(res, delay));
      return callGeminiAPI(prompt, isJsonResponse, retryCount + 1);
    }
    throw error;
  }
}

// Helper function to generate fallback questions based on resume
function generateResumeBasedQuestions(resumeText) {
  const resume = resumeText.toLowerCase();
  
  // Detect technologies
  const techs = [];
  const techKeywords = {
    'react': 'React',
    'node': 'Node.js',
    'python': 'Python',
    'java': 'Java',
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'mongodb': 'MongoDB',
    'sql': 'SQL',
    'aws': 'AWS',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'graphql': 'GraphQL',
    'express': 'Express.js'
  };
  
  for (const [key, value] of Object.entries(techKeywords)) {
    if (resume.includes(key)) {
      techs.push(value);
    }
  }
  
  const mainTech = techs[0] || 'relevant technologies';
  const techList = techs.slice(0, 3).join(', ') || 'your technical stack';
  
  return [
    `Based on your resume, can you tell me about your experience with ${techList}?`,
    `I see you have experience with ${mainTech}. Can you describe a specific project where you used this technology and what challenges you faced?`,
    `What do you consider your biggest technical achievement mentioned in your resume?`,
    `How do you approach debugging and problem-solving in ${mainTech} development?`,
    `Write a function to find the first non-repeating character in a string. Explain your approach and time complexity.`
  ];
}

// Middleware for JWT authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET || 'fallbacksecret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Multer setup for resume uploads
const upload = multer({ storage: multer.memoryStorage() });

// Resume upload & parsing
router.post('/upload-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const pdfBuffer = req.file.buffer;
    const data = await pdfParse(pdfBuffer);
    
    logWithTimestamp(`📄 Resume parsed: ${data.text.length} characters`);
    
    res.json({ text: data.text });
  } catch (err) {
    console.error('PDF parsing error:', err);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

// User profile fetch route
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('name email phone bio skills profilePic');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      bio: user.bio || '',
      skills: user.skills || [],
      imageUrl: user.profilePic || '',
    });
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register route
router.post('/register', async (req, res) => {
  const { name, email, password, phone = '', bio = '', skills = '' } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    let skillsArray = [];
    if (typeof skills === 'string' && skills.trim().length > 0) {
      skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(skills)) {
      skillsArray = skills.map(s => s.trim()).filter(Boolean);
    }

    await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      phone: phone.trim(),
      bio: bio.trim(),
      skills: skillsArray,
    });

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) return res.status(400).json({ error: 'All fields required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallbacksecret',
      { expiresIn: '2h' }
    );

    res.json({
      token,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      bio: user.bio,
      skills: user.skills
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Evaluate all questions in one batch call
router.post('/evaluate-test', authenticateToken, async (req, res) => {
  try {
    const { resumeText, questions, answers } = req.body;
    const userId = req.user.userId;

    if (!resumeText || !questions || !answers || questions.length !== answers.length) {
      return res.status(400).json({ error: "Invalid input data" });
    }

    logWithTimestamp(`📊 Starting batch evaluation for User: ${userId}`);

    const evaluationPrompt = `You are an expert technical interviewer. 
    Evaluate the following interview performance based on the candidate's resume.

    CANDIDATE'S RESUME:
    ${resumeText.substring(0, 2500)}

    INTERVIEW DATA:
    ${questions.map((q, i) => `[QUESTION ${i+1}]: ${q}\n[ANSWER ${i+1}]: ${answers[i] || "No answer provided"}`).join('\n\n')}

    EVALUATION REQUIREMENTS:
    1. Score each answer from 0 to 20 based on accuracy, technical depth, and communication.
    2. Provide 2 sentences of constructive feedback per question.
    3. Calculate a totalScore (sum of all individual scores).

    OUTPUT FORMAT:
    Return ONLY a JSON object with this exact structure:
    {
      "totalScore": 85,
      "evaluations": [
        { "score": 18, "feedback": "Great explanation of React hooks..." },
        { "score": 15, "feedback": "Solid logic, but could optimize time complexity..." }
      ]
    }`;

    try {
      const aiResponse = await callGeminiAPI(evaluationPrompt, true);
      const result = JSON.parse(aiResponse);

      // Map the AI response to your database schema
      const details = result.evaluations.map((evalItem, index) => ({
        question: questions[index],
        answer: answers[index] || "No answer given",
        individualScore: evalItem.score,
        feedback: evalItem.feedback
      }));

      // Save to MongoDB
      const testResult = new TestResult({
        userId,
        totalScore: result.totalScore,
        questions: details,
        createdAt: new Date()
      });
      await testResult.save();

      logWithTimestamp(`✅ Evaluation complete. Score: ${result.totalScore}/100`);

      res.json({ 
        success: true,
        score: result.totalScore, 
        details: details
      });

    } catch (error) {
      logWithTimestamp(`❌ AI Evaluation error: ${error.message}`);
      res.status(500).json({ error: "AI evaluation failed" });
    }

  } catch (err) {
    logWithTimestamp(`❌ Error in evaluation route:`, err);
    res.status(500).json({ error: "Server error during evaluation" });
  }
});

// Get user results
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const results = await TestResult.find({ userId }).sort({ createdAt: -1 });
    res.json({ results });
  } catch (err) {
    console.error('Failed to fetch results:', err);
    res.status(500).json({ error: 'Could not fetch results' });
  }
});

// Leaderboard API
router.get('/leaderboard', async (req, res) => {
  try {
    const results = await TestResult.aggregate([
      {
        $group: {
          _id: "$userId",
          totalPoints: { $sum: "$totalScore" },
          attempts: { $sum: 1 },
          averageScore: { $avg: "$totalScore" },
          bestScore: { $max: "$totalScore" }
        }
      },
      { $sort: { totalPoints: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          totalPoints: 1,
          attempts: 1,
          bestScore: 1,
          averageScore: { $round: ["$averageScore", 2] }
        }
      },
      { $limit: 100 }
    ]);
    res.json({ leaderboard: results });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// Update profile
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone = '', bio = '', skills = [], imageUrl = '' } = req.body;
    
    let newSkills = [];
    if (Array.isArray(skills)) {
      newSkills = skills.map(s => s.trim()).filter(Boolean);
    } else if (typeof skills === 'string') {
      newSkills = skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    const updateData = {
      name: name?.trim() || '',
      phone: phone?.trim() || '',
      bio: bio?.trim() || '',
      skills: newSkills,
      profilePic: imageUrl,
    };

    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === "undefined") delete updateData[key];
    });

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('name email phone bio skills profilePic');

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      bio: user.bio || '',
      skills: user.skills || [],
      imageUrl: user.profilePic || '',
    });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Start interview and generate 5 custom questions using JSON mode
router.post('/start-interview', authenticateToken, async (req, res) => {
  try {
    const { resumeText } = req.body;
    
    if (!resumeText) {
      return res.status(400).json({ error: "Resume text is required" });
    }

    logWithTimestamp(`📝 Generating questions for resume (${resumeText.length} chars)`);

    const prompt = `You are a professional technical recruiter. 
    Analyze the resume below and generate exactly 5 interview questions.
    
    CONSTRAINTS:
    - Questions 1-4: Focus on technical skills, projects, and experience found in the resume.
    - Question 5: Must be a specific coding, data structure, or algorithmic logic problem.
    - Questions must be challenging and specific to this candidate.

    OUTPUT FORMAT:
    You must return ONLY a JSON object with the following structure:
    {
      "questions": ["Question 1 text", "Question 2 text", "Question 3 text", "Question 4 text", "Question 5 text"]
    }

    RESUME CONTENT:
    ${resumeText.substring(0, 3000)}`;

    try {
      // Use 'true' to enable JSON response mode in callGeminiAPI
      const rawResponse = await callGeminiAPI(prompt, true);
      const parsedData = JSON.parse(rawResponse);

      if (!parsedData.questions || parsedData.questions.length !== 5) {
        throw new Error("Invalid question count in AI response");
      }

      res.json({ 
        questions: parsedData.questions,
        success: true 
      });

    } catch (error) {
      logWithTimestamp(`⚠️ AI Generation failed, using fallback: ${error.message}`);
      const fallback = generateResumeBasedQuestions(resumeText);
      res.json({ questions: fallback, success: true, isFallback: true });
    }
    
  } catch (err) {
    logWithTimestamp(`❌ Start interview error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;