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

// Your existing helper function for Gemini question generation...
async function generateInterviewQuestion(resumeText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Given this resume text, ask one strong, relevant interview question that tests the candidate's skills and experience. Only return one question, do not include explanations:\n\n${resumeText}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Gemini error details:", data);
    throw new Error(data.error?.message || 'Gemini API error');
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate question.";
}

// Middleware for JWT authentication
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

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
      imageUrl: user.profilePic || '', // <-- frontend gets as imageUrl
    });
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register route accepts extended fields
router.post('/register', async (req, res) => {
  const { name, email, password, phone = '', bio = '', skills = '' } = req.body;

  try {
    // Validate required
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Process skills string into array
    let skillsArray = [];
    if (typeof skills === 'string' && skills.trim().length > 0) {
      skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(skills)) {
      skillsArray = skills.map(s => s.trim()).filter(Boolean);
    }

    // Create and save user
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

    // Return userId explicitly here
    res.json({
      token,
      userId: user._id.toString(), // add this line
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
// Evaluate test route - AI powered
router.post('/evaluate-test', authenticateToken, async (req, res) => {
  try {
    const { resumeText, questions, answers } = req.body;
    if (!resumeText || !questions || !answers) {
      return res.status(400).json({ error: "Missing data." });
    }

    let totalScore = 0;
    let details = [];
    const userId = req.user.userId; // from JWT

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i] || "No answer given";

      const prompt = `
You are an experienced technical interviewer.
Here is the candidate's resume context:
${resumeText}

Question: ${question}
Candidate Answer: ${answer}

Score this answer from 0 to 20 based on:
1. Technical correctness
2. Completeness
3. Clarity of explanation
4. Relevance to the question

First line: ONLY the score (number between 0 and 20)
Second line: A short constructive feedback on how to improve.
`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const body = { contents: [{ parts: [{ text: prompt }] }] };

      const aiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!aiRes.ok) {
        const errorData = await aiRes.json();
        console.error("Gemini API error:", errorData);
        return res.status(500).json({ error: "AI evaluation failed" });
      }

      const aiData = await aiRes.json();
      console.log("🔍 AI Raw Response:", JSON.stringify(aiData, null, 2));

      let aiText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!aiText) aiText = "0\nNo feedback provided.";

      let [scoreLine, ...feedbackLines] = aiText.split("\n");
      let numericScore = parseInt(scoreLine.trim(), 10);
      if (isNaN(numericScore)) numericScore = 0;

      totalScore += numericScore;

      details.push({
        question,
        answer,
        individualScore: numericScore,
        feedback: feedbackLines.join(" ").trim(),
      });
    }

    // ✅ Save to DB
    await TestResult.create({ userId, totalScore, questions: details });

    res.json({ score: totalScore, details });

  } catch (err) {
    console.error("❌ Failed to evaluate test via AI:", err);
    res.status(500).json({ error: "Failed to evaluate test." });
  }
});

// Add after other routes, before module.exports
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const results = await TestResult.find({ userId })
      .sort({ createdAt: -1 }); // most recent first

    res.json({ results });
  } catch (err) {
    console.error('Failed to fetch user results:', err);
    res.status(500).json({ error: 'Could not fetch results' });
  }
});

// Leaderboard API: GET /api/user/leaderboard
// Leaderboard API: GET /api/user/leaderboard
// Leaderboard API: GET /api/user/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const results = await TestResult.aggregate([
      {
        // Sort all test results newest first
        $sort: { createdAt: -1 }
      },
      {
        // Group test results by userId
        $group: {
          _id: "$userId",
          totalPoints: { $sum: "$totalScore" },
          attempts: { $sum: 1 },
          averageScore: { $avg: "$totalScore" },
          bestScore: { $max: "$totalScore" },
          scoresList: { $push: "$totalScore" } // Array of scores (newest first due to $sort)
        }
      },
      {
        // Extract latestScore and previousScore from scoresList
        $project: {
          totalPoints: 1,
          attempts: 1,
          bestScore: 1,
          averageScore: { $round: ["$averageScore", 2] },
          latestScore: { $arrayElemAt: ["$scoresList", 0] },
          previousScore: {
            $cond: [
              { $gte: [{ $size: "$scoresList" }, 2] },
              { $arrayElemAt: ["$scoresList", 1] },
              null
            ]
          }
        }
      },
      { $sort: { totalPoints: -1 } },
      {
        // Join with users collection
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        // Final projection
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          totalPoints: 1,
          attempts: 1,
          bestScore: 1,
          averageScore: 1,
          latestScore: 1,
          previousScore: 1
        }
      },
      { $limit: 100 }
    ]);

    res.json({ leaderboard: results });
  } catch (err) {
    console.error("Error creating leaderboard:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});




// PATCH /profile to update user data
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      name,
      phone = '',
      bio = '',
      skills = [],
      imageUrl = ''
    } = req.body;
    
    // Sanitize and convert skills if received as string
    let newSkills = [];
    if (Array.isArray(skills)) {
      newSkills = skills.map(s => s.trim()).filter(Boolean);
    } else if (typeof skills === 'string') {
      newSkills = skills.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Prepare update object
    const updateData = {
      name: name?.trim() || '',
      phone: phone?.trim() || '',
      bio: bio?.trim() || '',
      skills: newSkills,
      profilePic: imageUrl,    // <<<<<<<<<<<<
    };

    // Remove fields with undefined values to avoid overwriting
    Object.keys(updateData).forEach(key => {
      if (typeof updateData[key] === "undefined") delete updateData[key];
    });

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true, context: 'query' }
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


// Start interview questions route (your existing code)
router.post('/start-interview', async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      return res.status(400).json({ error: "Resume text is required" });
    }

    async function getGeminiQuestion(type) {
      let prompt;
      if (type === "easy") {
        prompt = `Given this resume: ${resumeText}\nAsk ONE easy technical question (not coding) relevant to this candidate. Only return the question, do NOT add explanations.`;
      } else if (type === "output") {
        prompt = `Given this resume: ${resumeText}\nAsk ONE medium JavaScript interview question: provide a code snippet and ask the candidate "What is the output of the code and why?" Only return the question and code block, no explanations.`;
      } else if (type === "easycode") {
        prompt = `Given this resume: ${resumeText}\nAsk ONE simple coding interview question that requires the user to describe the logic in words (not write real code). Only give the question, no explanation.`;
      }
      return await generateInterviewQuestion(prompt);
    }

    const questions = [
      await getGeminiQuestion("easy"),
      await getGeminiQuestion("easy"),
      await getGeminiQuestion("output"),
      await getGeminiQuestion("output"),
      await getGeminiQuestion("easycode"),
    ];

    res.json({ questions });
  } catch (err) {
    console.error('Failed to generate interview questions:', err);
    res.status(500).json({ error: 'Failed to generate interview questions' });
  }
});

module.exports = router;
