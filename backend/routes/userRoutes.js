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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.8, // Slightly higher for more variation
        topP: 0.9
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY 
      },
      body: JSON.stringify(body),
      timeout: 15000
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Gemini API error: ${response.status}`, errorData);
      
      // Specific error handling
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      } else if (response.status === 400) {
        throw new Error('Invalid request to AI service.');
      } else {
        throw new Error(`AI service error: ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn('Unexpected AI response structure:', data);
      return "Could you describe your experience relevant to this role?";
    }
    
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error('Error in generateInterviewQuestion:', error.message);
    throw error; // Re-throw to be handled by caller
  }
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

router.post('/evaluate-test', authenticateToken, async (req, res) => {
  try {
    const { resumeText, questions, answers } = req.body;
    if (!resumeText || !questions || !answers) {
      return res.status(400).json({ error: "Missing data." });
    }

    // Validate arrays have same length
    if (questions.length !== answers.length) {
      return res.status(400).json({ error: "Questions and answers count mismatch" });
    }

    let totalScore = 0;
    let details = [];
    const userId = req.user.userId;

    // Process questions sequentially with delays
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i] || "No answer given";

      const prompt = `
You are an experienced technical interviewer. Score the candidate's answer.

RESUME CONTEXT:
${resumeText}

QUESTION: ${question}

CANDIDATE'S ANSWER: ${answer}

INSTRUCTIONS:
1. Score this answer from 0 to 20 (whole number only)
2. Consider: Technical correctness, Completeness, Clarity, Relevance
3. First line must be ONLY the numeric score (0-20)
4. Second line must be constructive feedback (1-2 sentences)

EXAMPLE:
15
Good explanation but could use more specific examples from the resume.

Now score this answer:
`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [{ 
          parts: [{ text: prompt }] 
        }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.2
        }
      };

      console.log(`Evaluating question ${i + 1}/${questions.length}`);

      const aiRes = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY 
        },
        body: JSON.stringify(requestBody)
      });

      // Check if response is OK
      if (!aiRes.ok) {
        console.error(`API Error - Status: ${aiRes.status}`);
        const errorText = await aiRes.text();
        console.error(`API Error - Response:`, errorText);
        
        // Use fallback scoring
        const fallbackScore = 10;
        totalScore += fallbackScore;
        details.push({
          question,
          answer,
          individualScore: fallbackScore,
          feedback: "Evaluation temporarily unavailable. Please try again later."
        });
        continue;
      }

      const aiData = await aiRes.json();
      
      // Parse AI response
      let aiText = "";
      if (aiData.candidates && aiData.candidates[0] && aiData.candidates[0].content) {
        aiText = aiData.candidates[0].content.parts[0].text || "";
      }
      
      if (!aiText) {
        console.warn(`Empty response for question ${i + 1}`);
        aiText = "10\nUnable to evaluate at this time.";
      }

      aiText = aiText.trim();
      
      // Extract score and feedback
      const lines = aiText.split('\n');
      let numericScore = 10; // Default
      let feedback = "No specific feedback available.";
      
      // Try to parse first line as score
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        const scoreMatch = firstLine.match(/\b(\d{1,2})\b/);
        if (scoreMatch) {
          numericScore = parseInt(scoreMatch[1], 10);
          numericScore = Math.min(Math.max(numericScore, 0), 20); // Clamp 0-20
        }
        
        // Use second line as feedback if available
        if (lines.length > 1) {
          feedback = lines.slice(1).join(' ').trim();
        } else {
          feedback = "Feedback not provided.";
        }
      }
      
      totalScore += numericScore;
      
      details.push({
        question,
        answer,
        individualScore: numericScore,
        feedback: feedback || "No feedback provided."
      });

      // Add delay between API calls to avoid rate limiting
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Save to database
    try {
      const testResult = new TestResult({
        userId,
        totalScore,
        questions: details
      });
      
      await testResult.save();
      console.log(`✅ Test result saved for user ${userId}, score: ${totalScore}`);
    } catch (dbError) {
      console.error("❌ Database save error:", dbError);
      // Don't fail the request if DB save fails, still return score
    }

    res.json({ 
      success: true,
      score: totalScore, 
      details,
      message: "Test evaluated successfully"
    });

  } catch (err) {
    console.error("❌ Critical error in evaluate-test:", err);
    res.status(500).json({ 
      error: "Failed to evaluate test.", 
      details: err.message 
    });
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
router.get('/leaderboard', async (req, res) => {
  try {
    const results = await TestResult.aggregate([
      {
        $group: {
          _id: "$userId",
          totalPoints: { $sum: "$totalScore" },
          attempts: { $sum: 1 },                        // ✅ Count attempts
          averageScore: { $avg: "$totalScore" },        // ✅ Average score
          bestScore: { $max: "$totalScore" }            // ✅ Best score
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
          averageScore: { $round: ["$averageScore", 2] } // Rounds average
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


router.post('/start-interview', authenticateToken, async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ error: "Resume text required" });

    // Extract keywords from resume for more specific questions
    const extractKeywords = (text) => {
      const commonWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'was', 'were']);
      const words = text.toLowerCase().split(/\W+/);
      const wordFreq = {};
      
      words.forEach(word => {
        if (word.length > 3 && !commonWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
      
      return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);
    };

    const keywords = extractKeywords(resumeText);
    console.log("Extracted keywords:", keywords);

    // Create diverse question prompts based on resume
    const questionTypes = [
      {
        type: "Technical Skills",
        prompt: `Based on this resume: ${resumeText}\nGenerate ONE specific technical question about ${keywords[0] || 'their technical skills'} that would be relevant for a job interview. Make it challenging but fair.`
      },
      {
        type: "Behavioral",
        prompt: `Based on this resume: ${resumeText}\nAsk ONE behavioral interview question about a time they demonstrated ${keywords[1] || 'problem-solving'} skills in a professional context.`
      },
      {
        type: "Problem-Solving",
        prompt: `Based on this resume: ${resumeText}\nCreate ONE scenario-based problem-solving question related to ${keywords[2] || 'their field'} that tests analytical thinking.`
      },
      {
        type: "Situational",
        prompt: `Based on this resume: ${resumeText}\nGenerate ONE situational question about handling ${keywords[3] || 'a challenging'} situation in a team environment.`
      },
      {
        type: "Technical Coding",
        prompt: `Based on this resume: ${resumeText}\nCreate ONE technical/coding question at an intermediate level related to ${keywords[4] || 'programming'}. Include a small code scenario if relevant.`
      }
    ];

    // Generate questions with better error handling
    const questions = [];
    
    for (let i = 0; i < questionTypes.length; i++) {
      try {
        const questionType = questionTypes[i];
        console.log(`Generating ${questionType.type} question...`);
        
        const question = await generateInterviewQuestion(questionType.prompt);
        
        if (question && question.trim().length > 10) {
          questions.push(question.trim());
        } else {
          // Fallback question for this type
          questions.push(getFallbackQuestion(i, keywords));
        }
        
        // Add delay to avoid rate limiting
        if (i < questionTypes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error generating question ${i + 1}:`, error);
        questions.push(getFallbackQuestion(i, keywords));
      }
    }

    // Ensure we have exactly 5 questions
    while (questions.length < 5) {
      questions.push(getFallbackQuestion(questions.length, keywords));
    }

    console.log("Generated questions:", questions);
    res.json({ questions });

  } catch (err) {
    console.error('Interview Generation Error:', err);
    // Comprehensive fallback questions
    const fallbackQuestions = [
      "Based on your resume, describe your most challenging technical project and what you learned from it.",
      "Tell me about a time you had to explain a complex technical concept to a non-technical stakeholder.",
      "Describe a situation where you had to troubleshoot a difficult problem under time pressure.",
      "How do you stay updated with the latest technologies and trends in your field?",
      "Walk me through how you would design a solution for [mention a common problem in their field]."
    ];
    res.json({ questions: fallbackQuestions });
  }
});

// Helper function for fallback questions
function getFallbackQuestion(index, keywords) {
  const fallbacks = [
    `What experience do you have with ${keywords[0] || 'key technologies'} mentioned in your resume?`,
    `Describe a project where you used ${keywords[1] || 'your skills'} to solve a real-world problem.`,
    `How would you approach learning a new ${keywords[2] || 'technology'} quickly for a project?`,
    `Tell me about a time you faced a significant challenge while working with ${keywords[3] || 'a team'}.`,
    `Explain ${keywords[4] || 'a technical concept'} as if you were teaching it to a junior developer.`
  ];
  
  return fallbacks[index % fallbacks.length];
}
module.exports = router;
