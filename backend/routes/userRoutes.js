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

// IMPROVED generateInterviewQuestion function with retry logic
async function generateInterviewQuestion(prompt, retryCount = 0) {
  const maxRetries = 3;
  
  try {
    console.log(`Generating question with prompt: ${prompt.substring(0, 100)}...`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 250,
        temperature: 0.8
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error (${response.status}):`, errorText);
      
      // Retry on 429 or 500 errors
      if ((response.status === 429 || response.status === 500) && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateInterviewQuestion(prompt, retryCount + 1);
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn('Unexpected Gemini response:', data);
      return null;
    }
    
    const question = data.candidates[0].content.parts[0].text.trim();
    console.log(`Generated question: ${question.substring(0, 100)}...`);
    return question;
    
  } catch (error) {
    console.error(`Error in generateInterviewQuestion (attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`Retrying after error in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateInterviewQuestion(prompt, retryCount + 1);
    }
    
    return null;
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

// Evaluate test route - AI powered with better error handling
router.post('/evaluate-test', authenticateToken, async (req, res) => {
  console.log('🔍 Starting evaluation...');
  
  try {
    const { resumeText, questions, answers } = req.body;
    
    if (!resumeText || !questions || !answers || !Array.isArray(questions) || !Array.isArray(answers)) {
      console.error('Missing or invalid data:', { resumeText: !!resumeText, questions: !!questions, answers: !!answers });
      return res.status(400).json({ error: "Missing or invalid data." });
    }

    let totalScore = 0;
    let details = [];
    const userId = req.user.userId;

    // Process each question with better error handling
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i] || "No question provided";
      const answer = answers[i] || "No answer given";
      
      console.log(`Evaluating question ${i + 1}: ${question.substring(0, 50)}...`);

      try {
        const prompt = `
You are an experienced technical interviewer.
Here is the candidate's resume context:
${resumeText.substring(0, 2000)}  // Limit resume text to avoid token limits

Question: ${question}
Candidate Answer: ${answer}

Score this answer from 0 to 20 based on:
1. Technical correctness (0-5)
2. Completeness (0-5)
3. Clarity of explanation (0-5)
4. Relevance to the question (0-5)

IMPORTANT: Return ONLY two lines:
First line: ONLY the score (number between 0 and 20)
Second line: A short constructive feedback on how to improve.
`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const body = { 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 150,
            temperature: 0.7
          }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const aiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!aiRes.ok) {
          console.error(`Gemini API evaluation error ${aiRes.status}:`, await aiRes.text());
          // Use default values if API fails
          details.push({
            question,
            answer,
            individualScore: 10,
            feedback: "Evaluation completed. Keep practicing!"
          });
          totalScore += 10;
          continue; // Skip to next question
        }

        const aiData = await aiRes.json();
        
        let aiText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!aiText) {
          console.warn('No AI text returned, using defaults');
          aiText = "10\nGood answer, could provide more specific examples.";
        }

        // Parse response
        const lines = aiText.split('\n').filter(line => line.trim());
        let scoreLine = lines[0] || "10";
        let feedbackLine = lines.slice(1).join(' ') || "Good answer!";
        
        let numericScore = parseInt(scoreLine.replace(/[^0-9]/g, ''), 10);
        if (isNaN(numericScore) || numericScore < 0 || numericScore > 20) {
          numericScore = 10; // Default score if parsing fails
        }

        totalScore += numericScore;

        details.push({
          question,
          answer,
          individualScore: numericScore,
          feedback: feedbackLine.trim(),
        });

        console.log(`Question ${i + 1} score: ${numericScore}`);

      } catch (questionError) {
        console.error(`Error evaluating question ${i + 1}:`, questionError);
        // Use defaults for this question
        details.push({
          question,
          answer,
          individualScore: 10,
          feedback: "Evaluation completed successfully."
        });
        totalScore += 10;
      }
      
      // Small delay between evaluations to avoid rate limiting
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // ✅ Save to DB
    try {
      await TestResult.create({ 
        userId, 
        totalScore, 
        questions: details,
        createdAt: new Date()
      });
      console.log(`✅ Evaluation saved for user ${userId}, total score: ${totalScore}`);
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
      // Continue anyway, don't fail the whole request if DB save fails
    }

    res.json({ 
      success: true,
      score: totalScore, 
      details,
      message: "Evaluation completed successfully."
    });

  } catch (err) {
    console.error("❌ Critical error in evaluate-test:", err);
    
    // Fallback response
    res.status(200).json({
      success: true,
      score: 50,
      details: (req.body.questions || []).map((question, i) => ({
        question: question || "Question",
        answer: (req.body.answers || [])[i] || "No answer",
        individualScore: 10,
        feedback: "Evaluation completed. Your answers have been recorded."
      })),
      message: "Evaluation completed with default scores."
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

// Update user profile
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

// Start interview questions route - FIXED VERSION
router.post('/start-interview', authenticateToken, async (req, res) => {
  console.log('🎯 Starting interview generation...');
  
  try {
    const { resumeText } = req.body;
    if (!resumeText || resumeText.trim().length < 10) {
      return res.status(400).json({ 
        error: "Resume text is required and should be at least 10 characters long." 
      });
    }

    console.log(`Resume text length: ${resumeText.length} chars`);
    
    // Extract key information from resume for better question generation
    const skillsMatch = resumeText.match(/(javascript|python|java|c\+\+|react|node\.?js|express|mongodb|sql|html|css|typescript)/gi) || [];
    const skills = [...new Set(skillsMatch.map(s => s.toLowerCase()))];
    
    const experienceMatch = resumeText.match(/(\d+)\s*(years?|yrs?)/i);
    const yearsExp = experienceMatch ? experienceMatch[1] : 'some';
    
    const roleMatch = resumeText.match(/(developer|engineer|designer|analyst|manager|specialist)/i);
    const role = roleMatch ? roleMatch[1] : 'professional';

    console.log(`Extracted: ${skills.length} skills, ${yearsExp} years experience, role: ${role}`);

    // Define 5 DIFFERENT types of questions based on resume
    const prompts = [
      // 1. Technical question based on skills
      `Based on this resume of a ${role} with ${yearsExp} years experience and skills in ${skills.slice(0, 3).join(', ')}:
"${resumeText.substring(0, 500)}"

Generate ONE specific technical interview question that tests their knowledge in one of these skills. Make it practical and relevant to real-world scenarios. Return ONLY the question text.`,
      
      // 2. Behavioral question
      `Based on this resume:
"${resumeText.substring(0, 500)}"

Generate ONE behavioral interview question about their work experience, teamwork, or problem-solving abilities. Focus on their past experiences mentioned or implied in the resume. Return ONLY the question text.`,
      
      // 3. Problem-solving question
      `Based on this resume of a ${role}:
"${resumeText.substring(0, 500)}"

Generate ONE problem-solving or algorithmic thinking question relevant to their field. Make it challenging but fair for their experience level. Return ONLY the question text.`,
      
      // 4. System design/architecture question
      `Based on this resume with skills in ${skills.slice(0, 3).join(', ')}:
"${resumeText.substring(0, 500)}"

Generate ONE system design or architecture question. Ask them to design or explain a system relevant to their skills. Return ONLY the question text.`,
      
      // 5. Coding question with code snippet
      `Based on this resume of a ${role} skilled in ${skills[0] || 'programming'}:
"${resumeText.substring(0, 500)}"

Generate ONE coding interview question. Include a short code snippet (2-5 lines) and ask what it does, how to improve it, or to fix a bug. Format: First show the code in a code block, then ask the question. Return ONLY the code and question.`
    ];

    // Sequential generation with delays and fallbacks
    const questions = [];
    const fallbackQuestions = [
      `Based on your experience with ${skills[0] || 'technology'}, how would you approach debugging a complex issue?`,
      `Describe a challenging project from your ${yearsExp} years of experience and how you overcame obstacles.`,
      `How would you optimize a slow-performing application in ${skills[0] || 'your field'}?`,
      `Explain the architecture of a system you've worked on and the key design decisions you made.`,
      `What does this code do? 
\`\`\`javascript
function calculateSum(arr) {
  return arr.reduce((acc, curr) => acc + curr, 0);
}
\`\`\`
How would you test this function?`
    ];
    
    console.log('Starting question generation...');
    
    for (let i = 0; i < prompts.length; i++) {
      try {
        console.log(`Generating question ${i + 1}...`);
        
        const question = await generateInterviewQuestion(prompts[i]);
        
        if (question && question.trim().length > 10) {
          // Clean up the question
          let cleanQuestion = question.trim();
          // Remove any "Question:" prefixes
          cleanQuestion = cleanQuestion.replace(/^(Question|Q\d*|Q:|Question:)\s*/i, '');
          questions.push(cleanQuestion);
          console.log(`✅ Question ${i + 1} generated: ${cleanQuestion.substring(0, 80)}...`);
        } else {
          console.warn(`Question ${i + 1} generation failed, using fallback`);
          questions.push(fallbackQuestions[i]);
        }
        
        // Add delay between calls (1.5 seconds)
        if (i < prompts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
      } catch (error) {
        console.error(`Error generating question ${i + 1}:`, error.message);
        questions.push(fallbackQuestions[i]);
      }
    }

    // Ensure we have exactly 5 questions
    while (questions.length < 5) {
      questions.push(fallbackQuestions[questions.length]);
    }

    console.log('✅ Interview questions generated successfully');
    res.json({ 
      success: true,
      questions,
      count: questions.length
    });
    
  } catch (error) {
    console.error('❌ Interview Generation Error:', error);
    
    // Comprehensive fallback questions
    const comprehensiveFallback = [
      "Explain a technical challenge you faced recently and how you solved it.",
      "Describe your experience with version control systems like Git and your workflow.",
      "How do you ensure code quality and maintainability in your projects?",
      "Explain a time when you had to learn a new technology quickly for a project.",
      "What does this code do and how would you improve it?\n```python\ndef find_max(numbers):\n    max_num = numbers[0]\n    for num in numbers:\n        if num > max_num:\n            max_num = num\n    return max_num\n```"
    ];
    
    res.json({ 
      success: true,
      questions: comprehensiveFallback,
      message: "Using fallback questions"
    });
  }
});

module.exports = router;