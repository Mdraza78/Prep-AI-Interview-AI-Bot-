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

// Utility function for Gemini API calls with retry logic
async function callGeminiAPI(prompt, retryCount = 0, maxRetries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.7,
      topP: 0.9
    }
  };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      if (retryCount < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, retryCount) + Math.random() * 1000, 15000);
        console.log(`⚠️ Rate limit hit. Retry ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callGeminiAPI(prompt, retryCount + 1, maxRetries);
      } else {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
    }
    
    if (!response.ok) {
      throw new Error(`API Error ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid API response structure');
    }
    
    return data.candidates[0].content.parts[0].text.trim();
    
  } catch (error) {
    if (retryCount < maxRetries && (error.name === 'AbortError' || error.message.includes('network'))) {
      const delay = 2000 * Math.pow(2, retryCount);
      console.log(`⚠️ Network error, retry ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
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

// Evaluate test route - BATCH ALL QUESTIONS IN ONE API CALL
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

    console.log(`📊 Evaluating ${questions.length} questions in a single batch request...`);

    // Create a single prompt that asks for evaluation of all questions at once
    let evaluationPrompt = `You are an experienced technical interviewer. Evaluate ALL the following interview answers based on the candidate's resume.

CANDIDATE'S RESUME:
${resumeText.substring(0, 2000)}

Here are the interview questions and the candidate's answers:

`;

    // Add all questions and answers to the prompt
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
IMPORTANT: Provide your evaluation in the following EXACT format for EACH question:

QUESTION 1:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

QUESTION 2:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

QUESTION 3:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

QUESTION 4:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

QUESTION 5:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

Provide scores between 0-20 for each question based on relevance, accuracy, completeness, and communication.`;

    try {
      // Make a single API call for all questions
      const aiResponse = await callGeminiAPI(evaluationPrompt, 0, 3);
      
      console.log("✅ Batch evaluation completed");
      console.log("AI Response preview:", aiResponse.substring(0, 500));
      
      // Parse the response to extract scores and feedback for each question
      let totalScore = 0;
      let details = [];
      
      for (let i = 1; i <= questions.length; i++) {
        let numericScore = 10;
        let feedback = "Evaluation completed.";
        
        // Extract score for this question
        const questionRegex = new RegExp(`QUESTION ${i}:\\s*(?:SCORE:\\s*(\\d{1,2})|.*?SCORE:\\s*(\\d{1,2}))`, 'is');
        const scoreMatch = aiResponse.match(questionRegex);
        
        if (scoreMatch) {
          const scoreValue = scoreMatch[1] || scoreMatch[2];
          numericScore = parseInt(scoreValue, 10);
          numericScore = Math.min(Math.max(numericScore, 0), 20);
        }
        
        // Extract feedback for this question
        const feedbackRegex = new RegExp(`QUESTION ${i}:[\\s\\S]*?FEEDBACK:\\s*([^\\n]+(?:\\n(?!QUESTION|SCORE:)[^\\n]+)*)`, 'i');
        const feedbackMatch = aiResponse.match(feedbackRegex);
        
        if (feedbackMatch) {
          feedback = feedbackMatch[1].trim();
        } else {
          // Try alternative pattern
          const altFeedbackRegex = new RegExp(`${i}\\.\\s*Score:\\s*\\d+\\s*Feedback:\\s*([^\\n]+)`, 'i');
          const altMatch = aiResponse.match(altFeedbackRegex);
          if (altMatch) {
            feedback = altMatch[1].trim();
          }
        }
        
        totalScore += numericScore;
        
        details.push({
          question: questions[i - 1],
          answer: answers[i - 1] || "No answer given",
          individualScore: numericScore,
          feedback: feedback
        });
        
        console.log(`📝 Question ${i}: Score ${numericScore}/20 - ${feedback.substring(0, 50)}...`);
      }
      
      // Save to database
      try {
        const testResult = new TestResult({
          userId,
          totalScore,
          questions: details,
          createdAt: new Date()
        });
        await testResult.save();
        console.log(`✅ Test saved: ${totalScore}/100`);
      } catch (dbError) {
        console.error("❌ DB error:", dbError.message);
      }
      
      res.json({ 
        success: true,
        score: totalScore, 
        details: details
      });
      
    } catch (error) {
      console.error("❌ AI evaluation error:", error.message);
      
      // Fallback: Provide default scores if AI fails
      console.log("⚠️ Using fallback evaluation");
      let totalScore = 0;
      let details = [];
      
      for (let i = 0; i < questions.length; i++) {
        const defaultScore = 15;
        totalScore += defaultScore;
        
        details.push({
          question: questions[i],
          answer: answers[i] || "No answer given",
          individualScore: defaultScore,
          feedback: "Evaluation temporarily unavailable. Please contact support if this persists."
        });
      }
      
      res.json({ 
        success: true,
        score: totalScore, 
        details: details,
        warning: "Used fallback evaluation due to AI service issues"
      });
    }

  } catch (err) {
    console.error("❌ Error in evaluation:", err);
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
    if (!resumeText) return res.status(400).json({ error: "Resume text is required" });

    const prompt = `
      You are an expert technical interviewer. Based on the following resume text, 
      generate exactly 5 interview questions. 
      
      Requirements:
      1. The first 4 questions should be technical/behavioral based on their projects and skills.
      2. The 5th question MUST be a coding logic question (Data Structures or Algorithms).
      3. Do NOT include any introductory text like "Sure, here are the questions".
      4. Provide the questions as a numbered list from 1 to 5.
      
      Resume Text:
      ${resumeText.substring(0, 3000)}
    `;

    console.log("🎯 Generating interview questions...");
    
    try {
      const rawResponse = await callGeminiAPI(prompt, 0, 3);
      
      if (!rawResponse) {
        throw new Error("No response from AI");
      }
      
      console.log("✅ Questions generated successfully");
      
      // Split the numbered list into an array of 5 strings
      let questions = rawResponse
        .split(/\d\.\s+/)
        .filter(q => q.trim().length > 0)
        .slice(0, 5);
      
      // Ensure we have exactly 5 questions
      if (questions.length !== 5) {
        console.log(`Expected 5 questions, got ${questions.length}. Using fallback.`);
        questions = [
          "Can you introduce yourself and tell me about your background?",
          "What is your most challenging project and how did you overcome obstacles?",
          "Explain a technical concept you're passionate about and why it matters.",
          "How do you handle tight deadlines and pressure?",
          "Write a function to reverse a linked list. Explain your approach."
        ];
      }
      
      res.json({ questions });
      
    } catch (error) {
      console.error("AI generation error:", error.message);
      // Fallback questions
      res.json({
        questions: [
          "Can you introduce yourself and tell me about your background?",
          "What is your most challenging project and how did you overcome obstacles?",
          "Explain a technical concept you're passionate about and why it matters.",
          "How do you handle tight deadlines and pressure?",
          "Write a function to check if a string is a palindrome. Explain your approach."
        ]
      });
    }
    
  } catch (err) {
    console.error("Start interview error:", err);
    res.status(500).json({ error: "Failed to start interview. Please try again." });
  }
});

module.exports = router;