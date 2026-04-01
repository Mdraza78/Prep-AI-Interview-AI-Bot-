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

async function generateInterviewQuestion(prompt) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.8,
        topP: 0.9
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      timeout: 15000
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Gemini API error: ${response.status}`, errorData);
      
      if (response.status === 429) {
        console.log('Rate limit hit, waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        return generateInterviewQuestion(prompt);
      }
      return null;
    }

    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn('Unexpected AI response structure:', data);
      return null;
    }
    
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error('Error in generateInterviewQuestion:', error.message);
    return null;
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

// Evaluate test route - AI powered
router.post('/evaluate-test', authenticateToken, async (req, res) => {
  try {
    const { resumeText, questions, answers } = req.body;
    if (!resumeText || !questions || !answers) {
      return res.status(400).json({ error: "Missing data." });
    }

    if (questions.length !== answers.length) {
      return res.status(400).json({ error: "Questions and answers count mismatch" });
    }

    let totalScore = 0;
    let details = [];
    const userId = req.user.userId;

    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing");
      return res.status(500).json({ error: "AI service not configured" });
    }

    // Process each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i] || "No answer given";

      const prompt = `You are an experienced interviewer. Evaluate this answer based on the candidate's resume.

CANDIDATE'S RESUME:
${resumeText.substring(0, 2000)}

QUESTION ASKED:
${question}

CANDIDATE'S ANSWER:
${answer}

Provide evaluation in this exact format:
SCORE: [number 0-20]
FEEDBACK: [2-3 sentences of constructive feedback]

SCORE:`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.3
        }
      };

      console.log(`📊 Evaluating question ${i + 1}/${questions.length}`);

      let numericScore = 10;
      let feedback = "Evaluation in progress...";

      try {
        const aiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        if (aiRes.status === 429) {
          feedback = "Rate limit reached. Using default evaluation.";
          console.log("⚠️ Rate limit hit");
        } else if (!aiRes.ok) {
          feedback = "Unable to evaluate at this time.";
          console.error(`API Error: ${aiRes.status}`);
        } else {
          const aiData = await aiRes.json();
          const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          console.log(`AI Response: ${aiText.substring(0, 200)}`);
          
          // Parse score and feedback
          const scoreMatch = aiText.match(/SCORE:\s*(\d{1,2})/i);
          if (scoreMatch) {
            numericScore = parseInt(scoreMatch[1], 10);
            numericScore = Math.min(Math.max(numericScore, 0), 20);
          }
          
          const feedbackMatch = aiText.match(/FEEDBACK:\s*([\s\S]+?)(?=$|SCORE:)/i);
          if (feedbackMatch) {
            feedback = feedbackMatch[1].trim();
          } else {
            feedback = aiText.replace(/SCORE:\s*\d+/i, '').trim() || "Good effort!";
          }
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        feedback = "Network issue. Answer recorded.";
      }

      totalScore += numericScore;
      
      details.push({
        question: question,
        answer: answer,
        individualScore: numericScore,
        feedback: feedback
      });

      console.log(`📝 Question ${i + 1}: Score ${numericScore}/20`);
      
      // Delay to avoid rate limits
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
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

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Failed to evaluate test." });
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

    // This prompt is the "Brain" - it tells Gemini exactly what to do
    const prompt = `
      You are an expert technical interviewer. Based on the following resume text, 
      generate exactly 5 interview questions. 
      
      Requirements:
      1. The first 4 questions should be technical/behavioral based on their projects and skills.
      2. The 5th question MUST be a coding logic question (Data Structures or Algorithms).
      3. Do NOT include any introductory text like "Sure, here are the questions".
      4. Provide the questions as a numbered list from 1 to 5.
      
      Resume Text:
      ${resumeText}
    `;

    const rawResponse = await generateInterviewQuestion(prompt);

    if (!rawResponse) {
      // Fallback only if the API fails completely
      return res.json({
        questions: [
          "Can you introduce yourself?",
          "What is your favorite programming language?",
          "Explain a challenging project you worked on.",
          "How do you handle deadlines?",
          "Write a function to reverse a string."
        ]
      });
    }

    // Split the numbered list into an array of 5 strings
    const questions = rawResponse
      .split(/\d\.\s+/)
      .filter(q => q.trim().length > 0)
      .slice(0, 5);

    res.json({ questions });
  } catch (err) {
    console.error("Start interview error:", err);
    res.status(500).json({ error: "Failed to start interview" });
  }
});

module.exports = router;