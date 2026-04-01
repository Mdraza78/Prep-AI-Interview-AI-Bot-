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

// Start interview - LET GEMINI GENERATE QUESTIONS BASED ON RESUME
router.post('/start-interview', authenticateToken, async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ error: "Resume text required" });

    console.log("📄 Resume text length:", resumeText.length);
    console.log("📄 Resume preview:", resumeText.substring(0, 500));

    // Let Gemini AI read the resume and generate 5 interview questions
    const prompt = `You are an experienced technical interviewer. Based on this candidate's resume, generate 5 interview questions.

RESUME:
${resumeText.substring(0, 3000)}

INSTRUCTIONS:
1. Analyze the resume carefully - understand their skills, experience, and projects
2. Generate 5 interview questions that are RELEVANT to what's in the resume
3. If they are a Data Analyst, ask about SQL, Python, Power BI, and their data projects
4. If they are a Developer, ask about their tech stack, coding, and development projects
5. Make questions specific to their experience - mention their projects by name
6. Vary question types: technical, behavioral, problem-solving, scenario-based
7. Each question should be challenging but fair based on their experience level

Return ONLY the 5 questions, one per line, numbered 1-5.

Example format:
1. [Question text]
2. [Question text]
3. [Question text]
4. [Question text]
5. [Question text]

Generate questions now:`;

    console.log("🤖 Asking Gemini to generate questions based on resume...");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      throw new Error("Failed to generate questions");
    }

    const data = await response.json();
    let questionsText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    console.log("📝 Gemini response:", questionsText);
    
    // Parse questions from response
    let questions = [];
    const lines = questionsText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        questions.push(match[1].trim());
      }
    }
    
    // If parsing failed, try to get any non-empty lines
    if (questions.length === 0) {
      questions = lines.filter(line => line.trim().length > 20).slice(0, 5);
    }
    
    // Ensure we have 5 questions
    while (questions.length < 5) {
      questions.push("Tell me about your most significant technical achievement mentioned in your resume.");
    }
    
    console.log(`✅ Generated ${questions.length} questions`);
    console.log("1.", questions[0]);
    console.log("2.", questions[1]);
    
    res.json({ questions: questions.slice(0, 5) });

  } catch (err) {
    console.error('❌ Error generating questions:', err);
    
    // Fallback questions based on common resume sections
    const fallbackQuestions = [
      "Tell me about your most challenging project mentioned in your resume. What was your role and what did you learn?",
      "What technical skills from your resume are you most confident in? Can you give an example of how you've used them?",
      "Describe a time you had to solve a complex problem. What approach did you take?",
      "Looking at your resume, which project are you most proud of and why?",
      "How do you stay updated with new technologies in your field?"
    ];
    
    res.json({ questions: fallbackQuestions });
  }
});

module.exports = router;