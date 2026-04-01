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

// Helper function with retry logic and exponential backoff
async function callGeminiAPIWithRetry(prompt, maxRetries = 3, baseDelay = 2000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.7,
          topP: 0.9
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (response.status === 429) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⚠️ Rate limit hit. Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Attempt ${attempt} failed: ${error.message}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, baseDelay));
    }
  }
}

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
      } else if (response.status === 400) {
        throw new Error('Invalid request to AI service.');
      } else {
        throw new Error(`AI service error: ${response.status}`);
      }
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

// Evaluate test route - AI powered with rate limit handling
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
      console.error("❌ GEMINI_API_KEY is missing in environment variables");
      return res.status(500).json({ error: "AI evaluation service is not configured" });
    }

    // Process questions sequentially with delays
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i] || "No answer given";

      const prompt = `You are an experienced technical interviewer. Evaluate this interview answer.

RESUME CONTEXT:
${resumeText.substring(0, 1500)}

QUESTION ${i + 1}:
${question}

CANDIDATE'S ANSWER:
${answer}

INSTRUCTIONS:
1. Score from 0-20 based on technical accuracy, completeness, and relevance to resume.
2. First line: ONLY the score (number between 0-20)
3. Second line: Constructive feedback (2-3 sentences)

EXAMPLE:
15
Good understanding of concepts. Could provide more specific examples from your experience.

Now evaluate:`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.3,
          topP: 0.8
        }
      };

      console.log(`📊 Evaluating question ${i + 1}/${questions.length}`);

      let numericScore = 10;
      let feedback = "Your answer was received but we couldn't generate detailed feedback. Please try again.";

      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          const aiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
          });

          console.log(`🔍 API Response Status: ${aiRes.status}`);

          if (aiRes.status === 429) {
            retryCount++;
            if (retryCount <= maxRetries) {
              const waitTime = 3000 * retryCount;
              console.log(`⚠️ Rate limit hit. Retry ${retryCount}/${maxRetries} after ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            } else {
              feedback = "Rate limit reached. Your answer has been saved but evaluation will be processed later.";
              break;
            }
          }

          if (!aiRes.ok) {
            const errorText = await aiRes.text();
            console.error(`❌ API Error ${aiRes.status}:`, errorText.substring(0, 200));
            feedback = "Unable to evaluate at this time. Please try again later.";
            break;
          }

          const aiData = await aiRes.json();
          console.log("✅ AI Response received");
          
          let aiText = "";
          if (aiData.candidates && aiData.candidates[0] && aiData.candidates[0].content) {
            aiText = aiData.candidates[0].content.parts[0].text || "";
            console.log(`AI Response: ${aiText.substring(0, 200)}...`);
          }
          
          if (aiText.trim()) {
            aiText = aiText.trim();
            const lines = aiText.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
              const firstLine = lines[0].trim();
              const scoreMatch = firstLine.match(/\b(\d{1,2})\b/);
              if (scoreMatch) {
                numericScore = parseInt(scoreMatch[1], 10);
                numericScore = Math.min(Math.max(numericScore, 0), 20);
                console.log(`✅ Extracted score: ${numericScore}`);
              }
              
              if (lines.length > 1) {
                feedback = lines.slice(1).join(' ').trim();
              } else {
                feedback = "Good effort! Try to provide more specific details from your experience.";
              }
            }
          }
          break;
          
        } catch (fetchError) {
          console.error(`❌ Fetch error for question ${i + 1}:`, fetchError.message);
          feedback = "Network issue. Your answer has been saved.";
          break;
        }
      }

      totalScore += numericScore;
      
      details.push({
        question: question,
        answer: answer,
        individualScore: numericScore,
        feedback: feedback
      });

      console.log(`📝 Question ${i + 1} evaluation: Score ${numericScore}/20`);
      
      // Delay between API calls
      if (i < questions.length - 1) {
        console.log(`⏱️ Waiting 3 seconds before next evaluation...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
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

// Start interview - generate questions based on resume
router.post('/start-interview', authenticateToken, async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) return res.status(400).json({ error: "Resume text required" });

    // Analyze resume to determine primary skill focus
    const analyzeResumeFocus = (text) => {
      const lowerText = text.toLowerCase();
      
      // Check for data-related keywords
      const dataKeywords = ['sql', 'python', 'pandas', 'power bi', 'excel', 'data analysis', 'data analyst', 'analytics', 'data cleaning', 'dashboard'];
      // Check for development-related keywords
      const devKeywords = ['react', 'node.js', 'express', 'mongodb', 'mern', 'full stack', 'frontend', 'backend', 'api', 'development'];
      
      let dataScore = 0;
      let devScore = 0;
      
      dataKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) dataScore += 2;
      });
      
      devKeywords.forEach(keyword => {
        if (lowerText.includes(keyword)) devScore += 2;
      });
      
      // Check projects section for more context
      if (lowerText.includes('sales & revenue analysis')) dataScore += 3;
      if (lowerText.includes('prep mind')) devScore += 3;
      if (lowerText.includes('lms')) devScore += 2;
      
      console.log(`Resume analysis - Data Score: ${dataScore}, Dev Score: ${devScore}`);
      
      if (dataScore >= devScore) {
        return { primary: 'data', secondary: 'development', mainTech: 'Data Analysis', skills: ['SQL', 'Python', 'Power BI'] };
      } else {
        return { primary: 'development', secondary: 'data', mainTech: 'Web Development', skills: ['React', 'Node.js', 'MongoDB'] };
      }
    };
    
    const focus = analyzeResumeFocus(resumeText);
    console.log(`🎯 Detected primary focus: ${focus.primary.toUpperCase()}`);

    // Generate questions based on primary focus
    let questionPrompts = [];
    
    if (focus.primary === 'data') {
      questionPrompts = [
        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE technical interview question about Data Analysis/SQL. Focus on SQL queries, data cleaning, or analytics.
The candidate has skills in: SQL, Python, Pandas, Power BI.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE behavioral question about a data analysis project they worked on.
Ask about their approach to solving data problems.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE scenario question about handling messy data or creating dashboards.
Make it relevant to their Sales & Revenue Analysis project.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE question about their experience with Python/Pandas for data analysis.
Ask about specific libraries or techniques they used.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE coding question about writing a SQL query or Python function for data analysis.
Make it practical and relevant to their experience.
Return ONLY the question text.`
      ];
    } else {
      questionPrompts = [
        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE technical interview question about MERN stack development.
The candidate has built projects with React, Node.js, MongoDB.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE behavioral question about a full-stack project they built.
Ask about challenges faced and solutions implemented.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE scenario question about building a feature for a web application.
Make it relevant to their Prep Mind or LMS project experience.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE question about their experience with React and state management.
Ask about specific components or patterns they used.
Return ONLY the question text.`,

        `Based on this resume: "${resumeText.substring(0, 1000)}"
Generate ONE coding question about implementing a feature in React or Node.js.
Make it practical and relevant to their experience level.
Return ONLY the question text.`
      ];
    }

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
          console.log(`✅ Question ${i + 1} generated`);
        } else {
          console.warn(`⚠️ Question ${i + 1} generation failed, using fallback`);
          questions.push(getFallbackQuestion(i, focus));
        }
        
        if (i < questionPrompts.length - 1) {
          console.log(`⏱️ Waiting 3 seconds before next question...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error(`❌ Error generating question ${i + 1}:`, error.message);
        questions.push(getFallbackQuestion(i, focus));
      }
    }

    while (questions.length < 5) {
      questions.push(getFallbackQuestion(questions.length, focus));
    }

    console.log("✅ All 5 questions generated successfully");
    res.json({ questions });

  } catch (err) {
    console.error('❌ Interview Generation Error:', err);
    
    const fallbackQuestions = [
      "Tell me about your most challenging technical project and what you learned from it.",
      "How do you approach learning new technologies or skills?",
      "Describe a time when you had to debug a complex issue.",
      "What are your strengths and how have you applied them in your projects?",
      "Where do you see yourself in your career in the next 2 years?"
    ];
    
    res.json({ questions: fallbackQuestions });
  }
});

function getFallbackQuestion(index, focus) {
  if (focus.primary === 'data') {
    const fallbacks = [
      "What experience do you have with SQL and how have you used it in your projects?",
      "Describe a data analysis project where you had to clean messy data. What approach did you take?",
      "How do you ensure the accuracy of your data analysis and reports?",
      "Tell me about your experience with Power BI or similar visualization tools.",
      "Write a SQL query to find the top 5 customers by total purchase amount."
    ];
    return fallbacks[index % fallbacks.length];
  } else {
    const fallbacks = [
      "What experience do you have with React and how do you manage state in your applications?",
      "Describe a full-stack application you built from scratch.",
      "How do you handle API integration in your projects?",
      "Tell me about your experience with MongoDB and database design.",
      "Write a React component that fetches and displays data from an API."
    ];
    return fallbacks[index % fallbacks.length];
  }
}

module.exports = router;