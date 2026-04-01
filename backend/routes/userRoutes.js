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

// Evaluate test route - AI powered (UPDATED VERSION)
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

    // Check if Gemini API key exists
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is missing in environment variables");
      return res.status(500).json({ error: "AI evaluation service is not configured" });
    }

    // Process questions sequentially with delays
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i] || "No answer given";

      // Improved prompt for better evaluation
      const prompt = `
You are an experienced technical interviewer. Evaluate this interview answer.

CANDIDATE'S RESUME CONTEXT:
${resumeText.substring(0, 2000)}  // Limit context size

INTERVIEW QUESTION ${i + 1}:
${question}

CANDIDATE'S ANSWER:
${answer}

INSTRUCTIONS:
1. Score this answer from 0 to 20 based on:
   - Technical correctness (if technical question)
   - Relevance to their resume experience
   - Clarity and completeness of explanation
   - Demonstration of skills mentioned in resume
   - Problem-solving approach

2. First line must be ONLY the numeric score (e.g., "15")

3. Second line must be constructive feedback (2-3 sentences):
   - What was good about the answer
   - What could be improved
   - How it relates to their resume

EXAMPLE FORMAT:
14
Good explanation of concepts, but could provide more specific examples from your resume. Consider mentioning your experience with React.js when discussing frontend architecture.

Now evaluate this answer:
`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [{ 
          parts: [{ text: prompt }] 
        }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.3,
          topP: 0.8
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          }
        ]
      };

      console.log(`📊 Evaluating question ${i + 1}/${questions.length}`);
      console.log(`Question: ${question.substring(0, 100)}...`);

      let aiText = "";
      let numericScore = 10; // Default score
      let feedback = "No specific feedback available at this time.";

      try {
        const aiRes = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });

        console.log(`🔍 API Response Status: ${aiRes.status}`);

        if (!aiRes.ok) {
          const errorText = await aiRes.text();
          console.error(`❌ API Error ${aiRes.status}:`, errorText.substring(0, 200));
          
          // More specific fallback based on error
          if (aiRes.status === 429) {
            feedback = "Rate limit reached. Using default evaluation.";
          } else if (aiRes.status === 400) {
            feedback = "AI service configuration issue.";
          } else {
            feedback = "AI evaluation service temporarily unavailable.";
          }
        } else {
          const aiData = await aiRes.json();
          console.log("✅ AI Response received");
          
          // Parse AI response
          if (aiData.candidates && aiData.candidates[0] && aiData.candidates[0].content) {
            aiText = aiData.candidates[0].content.parts[0].text || "";
            console.log(`AI Response text (first 200 chars): ${aiText.substring(0, 200)}...`);
          }
          
          if (aiText.trim()) {
            aiText = aiText.trim();
            const lines = aiText.split('\n').filter(line => line.trim());
            
            // Try to extract score from first line
            if (lines.length > 0) {
              const firstLine = lines[0].trim();
              const scoreMatch = firstLine.match(/\b(\d{1,2}|20)\b/);
              if (scoreMatch) {
                numericScore = parseInt(scoreMatch[1], 10);
                numericScore = Math.min(Math.max(numericScore, 0), 20);
                console.log(`✅ Extracted score: ${numericScore}`);
              }
              
              // Combine remaining lines for feedback
              if (lines.length > 1) {
                feedback = lines.slice(1).join(' ').trim();
              } else {
                feedback = "Good answer. Try to provide more specific examples from your experience.";
              }
            }
          } else {
            console.warn("Empty AI response");
            feedback = "AI evaluation did not return specific feedback.";
          }
        }
      } catch (fetchError) {
        console.error(`❌ Fetch error for question ${i + 1}:`, fetchError.message);
        feedback = "Network error during evaluation. Please try again.";
      }

      totalScore += numericScore;
      
      details.push({
        question: question,
        answer: answer,
        individualScore: numericScore,
        feedback: feedback || "Feedback not available."
      });

      console.log(`📝 Question ${i + 1} evaluation: Score ${numericScore}/20`);
      
      // Add delay between API calls to avoid rate limiting
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
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
      console.log(`✅ Test result saved for user ${userId}, total score: ${totalScore}/100`);
    } catch (dbError) {
      console.error("❌ Database save error:", dbError.message);
      // Continue even if DB save fails
    }

    res.json({ 
      success: true,
      score: totalScore, 
      details: details,
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

// Get user results
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const results = await TestResult.find({ userId })
      .sort({ createdAt: -1 });

    res.json({ results });
  } catch (err) {
    console.error('Failed to fetch user results:', err);
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
    console.error("Error creating leaderboard:", err);
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

// Start interview - generate questions
router.post('/start-interview', authenticateToken, async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ error: "Resume text required" });

    // Improved keyword extraction
    const extractKeywords = (text) => {
      const commonWords = new Set([
        'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'was', 'were',
        'been', 'are', 'has', 'had', 'will', 'would', 'should', 'could', 'about',
        'they', 'their', 'there', 'what', 'which', 'when', 'where', 'who', 'how',
        'your', 'you', 'our', 'can', 'more', 'very', 'just', 'also', 'than', 'then'
      ]);
      
      const techKeywords = [
        'javascript', 'react', 'node', 'python', 'java', 'sql', 'mongodb', 'express',
        'html', 'css', 'typescript', 'aws', 'docker', 'kubernetes', 'git', 'github',
        'api', 'rest', 'graphql', 'agile', 'scrum', 'testing', 'debugging', 'deployment'
      ];
      
      const words = text.toLowerCase().split(/[\s.,;:!?()\[\]{}]+/);
      const wordFreq = {};
      
      words.forEach(word => {
        if (word.length > 2 && !commonWords.has(word)) {
          const weight = techKeywords.includes(word) ? 3 : 1;
          wordFreq[word] = (wordFreq[word] || 0) + weight;
        }
      });
      
      return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(entry => entry[0]);
    };

    const keywords = extractKeywords(resumeText);
    console.log("🔍 Extracted keywords:", keywords);

    const mainTech = keywords[0] || 'software development';
    const secondaryTech = keywords[1] || 'technical projects';

    const questionPrompts = [
      `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE specific technical interview question about ${mainTech} that tests deep understanding.
Make it challenging but fair for someone with the experience shown in the resume.
Question should be specific to ${mainTech} concepts or implementation.
Return ONLY the question text.`,

      `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE behavioral interview question asking about their experience with ${secondaryTech}.
The question should ask them to describe a specific project or situation.
Make it relevant to the technologies mentioned in the resume.
Return ONLY the question text.`,

      `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE scenario-based problem-solving question related to ${mainTech}.
The question should present a realistic work challenge they might face.
Make it specific to their field/technology mentioned in resume.
Return ONLY the question text.`,

      `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE system design or architecture question relevant to ${mainTech}.
The question should test their ability to design solutions at scale.
Make it appropriate for their experience level.
Return ONLY the question text.`,

      `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE specific coding/programming question for ${mainTech}.
The question should require writing actual code or pseudocode.
Make it appropriate for an intermediate-level developer.
Include specific requirements or constraints.
Example format: "Write a function that..." or "Implement a solution for..."
Return ONLY the question text.`
    ];

    const questions = [];
    
    for (let i = 0; i < questionPrompts.length; i++) {
      try {
        console.log(`🔄 Generating question ${i + 1}/5...`);
        
        const question = await generateInterviewQuestion(questionPrompts[i]);
        
        if (question && question.trim().length > 20) {
          const cleanQuestion = question.trim()
            .replace(/^["']|["']$/g, '')
            .replace(/^Question\s*\d*[.:]\s*/i, '');
          
          questions.push(cleanQuestion);
          console.log(`✅ Question ${i + 1} generated: ${cleanQuestion.substring(0, 80)}...`);
        } else {
          console.warn(`⚠️ Question ${i + 1} too short, using fallback`);
          questions.push(getResumeSpecificFallback(i, keywords, resumeText));
        }
        
        if (i < questionPrompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      } catch (error) {
        console.error(`❌ Error generating question ${i + 1}:`, error.message);
        questions.push(getResumeSpecificFallback(i, keywords, resumeText));
      }
    }

    while (questions.length < 5) {
      questions.push(getResumeSpecificFallback(questions.length, keywords, resumeText));
    }

    console.log("✅ All questions generated");
    res.json({ questions });

  } catch (err) {
    console.error('❌ Interview Generation Error:', err);
    
    const fallbackQuestions = [
      "Based on your resume, walk me through your most challenging technical project. What specific technologies did you use and what problems did you solve?",
      "Describe a situation where you had to learn a new technology quickly for a project. How did you approach it and what was the outcome?",
      "How do you ensure code quality and maintainability in your projects? Give examples from your experience.",
      "Tell me about a time you had to debug a complex issue. What was your systematic approach to finding and fixing it?",
      "Write a function that demonstrates your understanding of core programming concepts. Explain your approach and time complexity."
    ];
    
    res.json({ questions: fallbackQuestions });
  }
});

// Helper function for fallback questions
function getResumeSpecificFallback(index, keywords, resumeText) {
  const mainTech = keywords[0] || 'your primary technology';
  const secondaryTech = keywords[1] || 'key skills';
  
  const fallbacks = [
    `What experience do you have with ${mainTech}? Can you give specific examples from projects mentioned in your resume?`,
    `Describe a project where you used ${secondaryTech} to solve a real-world problem. What was your role and what challenges did you face?`,
    `How would you approach optimizing a ${mainTech} application for better performance? What metrics would you track?`,
    `Tell me about a time you had to collaborate with a team on a technical project. What was your contribution and what did you learn?`,
    `Write a solution for: Given a problem related to ${mainTech}, how would you implement it? Consider edge cases and efficiency.`
  ];
  
  return fallbacks[index % fallbacks.length];
}

module.exports = router;