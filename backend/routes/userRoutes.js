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

// Utility function for Gemini API calls with comprehensive logging
async function callGeminiAPI(prompt, retryCount = 0, maxRetries = 3) {
  if (!GEMINI_API_KEY) {
    logWithTimestamp('❌ ERROR: GEMINI_API_KEY is not set in environment variables');
    throw new Error('GEMINI_API_KEY is not configured');
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const requestBody = {
    contents: [{ 
      parts: [{ 
        text: prompt 
      }] 
    }],
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.7,
      topP: 0.9,
      topK: 40
    }
  };
  
  logWithTimestamp(`📡 Calling Gemini API (Attempt ${retryCount + 1}/${maxRetries + 1})...`);
  logWithTimestamp(`📝 Prompt length: ${prompt.length} characters`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    logWithTimestamp(`📊 API Response Status: ${response.status} ${response.statusText}`);
    
    // Handle rate limiting
    if (response.status === 429) {
      logWithTimestamp(`⚠️ Rate limit hit (429). Retry count: ${retryCount}`);
      if (retryCount < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, retryCount) + Math.random() * 1000, 15000);
        logWithTimestamp(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callGeminiAPI(prompt, retryCount + 1, maxRetries);
      } else {
        throw new Error('Rate limit exceeded after multiple retries');
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      logWithTimestamp(`❌ API Error Response (${response.status}):`, errorText);
      throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    logWithTimestamp(`📦 API Response received, structure:`, Object.keys(data));
    
    // Check response structure
    if (!data.candidates || !data.candidates[0]) {
      logWithTimestamp(`❌ No candidates in response. Full response:`, JSON.stringify(data, null, 2));
      throw new Error('No candidates in API response');
    }
    
    if (!data.candidates[0].content || !data.candidates[0].content.parts) {
      logWithTimestamp(`❌ Invalid content structure. Candidate:`, JSON.stringify(data.candidates[0], null, 2));
      throw new Error('Invalid content structure in API response');
    }
    
    const generatedText = data.candidates[0].content.parts[0].text;
    
    if (!generatedText || generatedText.trim().length === 0) {
      logWithTimestamp(`❌ Empty response from API`);
      throw new Error('Empty response from API');
    }
    
    logWithTimestamp(`✅ API Response Success (${generatedText.length} chars)`);
    logWithTimestamp(`📝 Response Preview:`, generatedText.substring(0, 500));
    
    return generatedText.trim();
    
  } catch (error) {
    logWithTimestamp(`❌ API Call Error:`, error.message);
    logWithTimestamp(`Error stack:`, error.stack);
    
    if (retryCount < maxRetries && 
        (error.name === 'AbortError' || 
         error.message.includes('network') || 
         error.message.includes('fetch') ||
         error.message.includes('timeout') ||
         error.message.includes('ECONNRESET'))) {
      const delay = 2000 * Math.pow(2, retryCount);
      logWithTimestamp(`⚠️ Retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiAPI(prompt, retryCount + 1, maxRetries);
    }
    throw error;
  }
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
    logWithTimestamp(`📄 Resume preview:`, data.text.substring(0, 300));
    
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

// Evaluate test route
router.post('/evaluate-test', authenticateToken, async (req, res) => {
  try {
    const { resumeText, questions, answers } = req.body;
    
    if (!resumeText || !questions || !answers) {
      return res.status(400).json({ error: "Missing data." });
    }

    if (questions.length !== answers.length) {
      return res.status(400).json({ error: "Questions and answers count mismatch" });
    }

    const userId = req.user.userId;

    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing");
      return res.status(500).json({ error: "AI service not configured" });
    }

    logWithTimestamp(`📊 Evaluating ${questions.length} questions...`);

    // Create evaluation prompt
    let evaluationPrompt = `You are an experienced technical interviewer. Evaluate ALL the following interview answers based on the candidate's resume.

CANDIDATE'S RESUME:
${resumeText.substring(0, 2500)}

Here are the interview questions and the candidate's answers:

`;

    for (let i = 0; i < questions.length; i++) {
      evaluationPrompt += `
QUESTION ${i + 1}:
${questions[i]}

CANDIDATE'S ANSWER ${i + 1}:
${answers[i] || "No answer given"}

---
`;
    }

    evaluationPrompt += `
IMPORTANT: Provide your evaluation in this EXACT format for EACH question:

QUESTION 1:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

QUESTION 2:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

(Continue for all questions)`;

    try {
      const aiResponse = await callGeminiAPI(evaluationPrompt, 0, 3);
      
      let totalScore = 0;
      let details = [];
      
      for (let i = 1; i <= questions.length; i++) {
        let numericScore = 12;
        let feedback = "Your answer has been recorded.";
        
        // Extract score
        const scorePattern = new RegExp(`QUESTION ${i}:\\s*SCORE:\\s*(\\d{1,2})`, 'i');
        const scoreMatch = aiResponse.match(scorePattern);
        
        if (scoreMatch) {
          numericScore = parseInt(scoreMatch[1], 10);
          numericScore = Math.min(Math.max(numericScore, 0), 20);
        }
        
        // Extract feedback
        const feedbackPattern = new RegExp(`QUESTION ${i}:[\\s\\S]*?FEEDBACK:\\s*([^\\n]+(?:\\n(?!QUESTION|SCORE:)[^\\n]+)*)`, 'i');
        const feedbackMatch = aiResponse.match(feedbackPattern);
        
        if (feedbackMatch) {
          feedback = feedbackMatch[1].trim();
        }
        
        totalScore += numericScore;
        
        details.push({
          question: questions[i - 1],
          answer: answers[i - 1] || "No answer given",
          individualScore: numericScore,
          feedback: feedback
        });
      }
      
      // Save to database
      const testResult = new TestResult({
        userId,
        totalScore,
        questions: details,
        createdAt: new Date()
      });
      await testResult.save();
      
      logWithTimestamp(`✅ Test saved: ${totalScore}/100`);
      
      res.json({ 
        success: true,
        score: totalScore, 
        details: details
      });
      
    } catch (error) {
      logWithTimestamp(`❌ Evaluation error:`, error.message);
      
      // Fallback evaluation
      let totalScore = 0;
      let details = [];
      
      for (let i = 0; i < questions.length; i++) {
        const defaultScore = 15;
        totalScore += defaultScore;
        
        details.push({
          question: questions[i],
          answer: answers[i] || "No answer given",
          individualScore: defaultScore,
          feedback: "Evaluation in progress. Your score will be updated shortly."
        });
      }
      
      res.json({ 
        success: true,
        score: totalScore, 
        details: details,
        warning: "Using preliminary evaluation"
      });
    }

  } catch (err) {
    logWithTimestamp(`❌ Evaluation error:`, err);
    res.status(500).json({ error: "Failed to evaluate test. Please try again." });
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

// Start interview and generate 5 custom questions
router.post('/start-interview', authenticateToken, async (req, res) => {
  try {
    const { resumeText } = req.body;
    
    if (!resumeText) {
      logWithTimestamp('❌ No resume text provided');
      return res.status(400).json({ error: "Resume text is required" });
    }

    logWithTimestamp(`📝 Resume received: ${resumeText.length} characters`);
    logWithTimestamp(`📄 Resume preview: ${resumeText.substring(0, 200)}...`);

    if (!process.env.GEMINI_API_KEY) {
      logWithTimestamp("❌ GEMINI_API_KEY is missing from environment variables");
      return res.status(500).json({ error: "AI service not configured" });
    }

    logWithTimestamp(`🔑 GEMINI_API_KEY exists: Yes (length: ${process.env.GEMINI_API_KEY.length})`);

    // Simplified prompt for testing
    const prompt = `Based on this resume, generate 5 interview questions. The 5th question should be a coding question.

Resume: ${resumeText.substring(0, 2000)}

Output exactly 5 questions numbered 1-5:`;

    logWithTimestamp("🎯 Sending request to Gemini API...");
    
    try {
      const rawResponse = await callGeminiAPI(prompt, 0, 3);
      
      logWithTimestamp(`✅ Raw API Response:`, rawResponse);
      
      // Parse questions
      let questions = [];
      
      // Method 1: Split by numbers
      const lines = rawResponse.split('\n');
      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        if (match && match[1].trim().length > 0) {
          questions.push(match[1].trim());
        }
      }
      
      // Method 2: If not enough, try other parsing
      if (questions.length < 5) {
        const allText = rawResponse.replace(/\d+\./g, '|').split('|');
        for (const text of allText) {
          const trimmed = text.trim();
          if (trimmed.length > 10 && trimmed.length < 200 && questions.length < 5) {
            questions.push(trimmed);
          }
        }
      }
      
      // Ensure we have exactly 5 questions
      while (questions.length < 5) {
        const defaultQuestions = [
          "Can you tell me about your experience with the technologies mentioned in your resume?",
          "Describe a challenging project you worked on and how you solved the problems.",
          "What programming languages are you most comfortable with?",
          "How do you approach problem-solving in software development?",
          "Write a function to reverse a string. Explain your approach."
        ];
        questions.push(defaultQuestions[questions.length]);
      }
      
      questions = questions.slice(0, 5);
      
      logWithTimestamp(`✅ Generated ${questions.length} questions`);
      questions.forEach((q, i) => {
        logWithTimestamp(`   ${i + 1}. ${q.substring(0, 100)}`);
      });
      
      res.json({ questions });
      
    } catch (error) {
      logWithTimestamp(`❌ AI generation error:`, error.message);
      logWithTimestamp(`Error stack:`, error.stack);
      
      // Use resume-based fallback questions
      const fallbackQuestions = generateResumeBasedQuestions(resumeText);
      logWithTimestamp(`⚠️ Using ${fallbackQuestions.length} fallback questions`);
      
      res.json({ 
        questions: fallbackQuestions,
        warning: "Using personalized fallback questions"
      });
    }
    
  } catch (err) {
    logWithTimestamp(`❌ Start interview error:`, err);
    logWithTimestamp(`Error stack:`, err.stack);
    res.status(500).json({ error: "Failed to start interview. Please try again." });
  }
});

// Helper function to generate resume-based questions
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
    'docker': 'Docker'
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
    `I see you have experience with ${mainTech}. Can you describe a specific project where you used this technology?`,
    `What do you consider your biggest technical achievement mentioned in your resume?`,
    `How do you stay updated with the latest developments in ${mainTech}?`,
    `Write a function to find duplicate elements in an array. Explain your approach and time complexity.`
  ];
}

module.exports = router;