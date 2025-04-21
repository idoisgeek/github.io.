// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios'); // For making API calls

const app = express();
const PORT = process.env.PORT || 3001;
const CASES_FILE = path.join(__dirname, 'cases.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

// Check if API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set in environment variables');
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname)); // Serve static files from current directory

// Helper middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Helper function to read cases
function readCases() {
  try {
    if (!fs.existsSync(CASES_FILE)) {
      // Create empty cases file if it doesn't exist
      fs.writeFileSync(CASES_FILE, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(CASES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading cases:', error);
    return [];
  }
}

// Helper function to write cases
function writeCases(cases) {
  try {
    fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing cases:', error);
    return false;
  }
}

// Helper function to read sessions
function readSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      // Create empty sessions file if it doesn't exist
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

// Helper function to write sessions
function writeSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    
    // Also save sessions to sessions.txt in a readable format
    writeSessionsToTextFile(sessions);
    
    return true;
  } catch (error) {
    console.error('Error writing sessions:', error);
    return false;
  }
}

// Helper function to write sessions to a text file in a readable format
function writeSessionsToTextFile(sessions) {
  try {
    const SESSIONS_TEXT_FILE = path.join(__dirname, 'sessions.txt');
    let textContent = '=== SESSIONS LOG ===\n\n';
    
    // Sort sessions by timestamp (newest first)
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedSessions.forEach(session => {
      const date = new Date(session.timestamp).toLocaleString();
      
      textContent += `===== SESSION ID: ${session.id} =====\n`;
      textContent += `CASE: ${session.caseName}\n`;
      textContent += `DATE: ${date}\n`;
      textContent += `USER: ${session.userName || 'Anonymous'}\n`;
      textContent += `CASE PROMPT: ${session.casePrompt || 'Not available'}\n\n`;
      
      // Include differential diagnosis if available
      if (session.diagnosis && session.diagnosis.trim()) {
        textContent += `DIFFERENTIAL DIAGNOSIS:\n${session.diagnosis}\n\n`;
      } else {
        textContent += `DIFFERENTIAL DIAGNOSIS: Not provided\n\n`;
      }
      
      textContent += `CONVERSATION:\n`;
      
      if (session.messages && session.messages.length > 0) {
        session.messages.forEach(message => {
          const role = message.role.toUpperCase();
          textContent += `${role}: ${message.content}\n\n`;
        });
      } else {
        textContent += `No messages available\n\n`;
      }
      
      // Include AI review if available
      if (session.review) {
        textContent += `AI REVIEW:\n${session.review}\n\n`;
      }
      
      textContent += `=================================\n\n`;
    });
    
    fs.writeFileSync(SESSIONS_TEXT_FILE, textContent);
    console.log(`Sessions saved to ${SESSIONS_TEXT_FILE}`);
    
    return true;
  } catch (error) {
    console.error('Error writing sessions to text file:', error);
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Server is running correctly'
  });
});

// GET /cases - Get all cases
app.get('/cases', (req, res) => {
  try {
    const cases = readCases();
    res.json(cases);
  } catch (error) {
    console.error('Error in GET /cases:', error);
    res.status(500).json({ error: 'Failed to retrieve cases' });
  }
});

// POST /cases - Create a new case
app.post('/cases', (req, res) => {
  try {
    const cases = readCases();
    const newCase = req.body;
    
    // Validate required fields
    if (!newCase.name || !newCase.prompt) {
      return res.status(400).json({ error: 'Name and prompt are required fields' });
    }
    
    // Check if case with same name already exists
    if (cases.some(c => c.name === newCase.name)) {
      return res.status(409).json({ error: 'A case with this name already exists' });
    }
    
    // Add timestamp if not provided
    if (!newCase.timestamp) {
      newCase.timestamp = new Date().toISOString();
    }
    
    cases.push(newCase);
    
    if (writeCases(cases)) {
      res.status(201).json(newCase);
    } else {
      res.status(500).json({ error: 'Failed to save the case' });
    }
  } catch (error) {
    console.error('Error in POST /cases:', error);
    res.status(500).json({ error: 'Failed to create case: ' + error.message });
  }
});

// DELETE /cases/:name - Delete a case by name
app.delete('/cases/:name', (req, res) => {
  try {
    const caseName = req.params.name;
    const cases = readCases();
    
    const initialLength = cases.length;
    const filteredCases = cases.filter(c => c.name !== caseName);
    
    if (filteredCases.length === initialLength) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    if (writeCases(filteredCases)) {
      res.json({ message: 'Case deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete the case' });
    }
  } catch (error) {
    console.error('Error in DELETE /cases/:name:', error);
    res.status(500).json({ error: 'Failed to delete case: ' + error.message });
  }
});

// PUT /cases/:name - Update a case by name
app.put('/cases/:name', (req, res) => {
  try {
    const caseName = req.params.name;
    const updatedCase = req.body;
    const cases = readCases();
    
    // Validate required fields
    if (!updatedCase.name || !updatedCase.prompt) {
      return res.status(400).json({ error: 'Name and prompt are required fields' });
    }
    
    // Find the case to update
    const caseIndex = cases.findIndex(c => c.name === caseName);
    if (caseIndex === -1) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    // Check for name conflict if the name is being changed
    if (updatedCase.name !== caseName && cases.some(c => c.name === updatedCase.name)) {
      return res.status(409).json({ error: 'A case with this new name already exists' });
    }
    
    // Preserve the original timestamp if not provided
    if (!updatedCase.timestamp) {
      updatedCase.timestamp = cases[caseIndex].timestamp;
    }
    
    // Update the case
    cases[caseIndex] = updatedCase;
    
    if (writeCases(cases)) {
      console.log(`Case "${caseName}" updated to "${updatedCase.name}"`);
      res.json(updatedCase);
    } else {
      res.status(500).json({ error: 'Failed to save the updated case' });
    }
  } catch (error) {
    console.error('Error in PUT /cases/:name:', error);
    res.status(500).json({ error: 'Failed to update case: ' + error.message });
  }
});

// GET /get-sessions - Get all sessions
app.get('/get-sessions', (req, res) => {
  try {
    const sessions = readSessions();
    // Sort sessions by timestamp (newest first)
    sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(sessions);
  } catch (error) {
    console.error('Error in GET /get-sessions:', error);
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

// POST /save-session - Save a session
app.post('/save-session', (req, res) => {
  try {
    const { id, caseId, caseName, messages, userName, review, lastUpdated, casePrompt, diagnosis } = req.body;
    
    // Get existing sessions
    const sessions = readSessions();
    
    // If an ID is provided, try to update an existing session
    if (id) {
      const sessionIndex = sessions.findIndex(s => s.id === id);
      if (sessionIndex >= 0) {
        // Update the existing session
        const existingSession = sessions[sessionIndex];
        const updatedSession = {
          ...existingSession,
          caseId: caseId || existingSession.caseId,
          caseName: caseName || existingSession.caseName,
          userName: userName || existingSession.userName,
          messages: messages || existingSession.messages,
          casePrompt: casePrompt || existingSession.casePrompt,
          diagnosis: diagnosis !== undefined ? diagnosis : existingSession.diagnosis,
          lastUpdated: lastUpdated || new Date().toISOString()
        };
        
        // Add review if provided
        if (review) {
          updatedSession.review = review;
        }
        
        sessions[sessionIndex] = updatedSession;
        
        if (writeSessions(sessions)) {
          console.log(`Session updated for case: "${updatedSession.caseName}" by user: "${updatedSession.userName}"`);
          res.json({ success: true, session: updatedSession });
        } else {
          res.status(500).json({ error: 'Failed to update session' });
        }
        return;
      }
    }
    
    // Create a new session if no ID was provided or no matching session was found
    // Validate required fields for new sessions
    if (!caseId || !caseName || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or invalid data format' });
    }

    // Create a new session object with unique ID
    const newSession = {
      id: id || Date.now().toString(), // Use provided ID or generate a new one
      caseId,
      caseName,
      userName: userName || 'Anonymous', // Use 'Anonymous' if userName is not provided
      casePrompt: casePrompt || '',
      diagnosis: diagnosis || '',
      timestamp: new Date().toISOString(),
      messages
    };
    
    // Add review if provided
    if (review) {
      newSession.review = review;
    }

    // Add the new session
    sessions.push(newSession);
    
    // Save sessions to file
    if (writeSessions(sessions)) {
      console.log(`Session saved for case: "${caseName}" by user: "${newSession.userName}" (${messages.length} messages)`);
      if (diagnosis) {
        console.log(`Differential diagnosis included (${diagnosis.length} chars)`);
      }
      res.status(201).json({ success: true, session: newSession });
    } else {
      res.status(500).json({ error: 'Failed to save session' });
    }
  } catch (error) {
    console.error('Error in POST /save-session:', error);
    res.status(500).json({ error: 'Failed to save session: ' + error.message });
  }
});

// DELETE /sessions/:id - Delete a session by ID
app.delete('/sessions/:id', (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Get existing sessions
    const sessions = readSessions();
    
    // Find the session with the specified ID
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get the session details for logging
    const { caseName } = sessions[sessionIndex];
    
    // Remove the session from the array
    sessions.splice(sessionIndex, 1);
    
    // Save the updated sessions
    if (writeSessions(sessions)) {
      console.log(`Session deleted for case: "${caseName}" (ID: ${sessionId})`);
      res.json({ success: true, message: 'Session deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete session' });
    }
  } catch (error) {
    console.error('Error in DELETE /sessions/:id:', error);
    res.status(500).json({ error: 'Failed to delete session: ' + error.message });
  }
});

// DELETE /sessions - Delete all sessions
app.delete('/sessions', (req, res) => {
  try {
    // Get existing sessions to count them
    const sessions = readSessions();
    const count = sessions.length;
    
    // Write an empty array to the sessions file
    if (writeSessions([])) {
      console.log(`All sessions deleted (${count} sessions)`);
      res.json({ success: true, message: `All sessions deleted successfully (${count} sessions)` });
    } else {
      res.status(500).json({ error: 'Failed to delete all sessions' });
    }
  } catch (error) {
    console.error('Error in DELETE /sessions:', error);
    res.status(500).json({ error: 'Failed to delete all sessions: ' + error.message });
  }
});

// Proxy endpoint for OpenAI API calls
app.post('/api/openai', async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const { model, messages, temperature } = req.body;
    
    // Validate request body
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request. Required fields: model, messages (array)' });
    }
    
    // Forward request to OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model,
      messages,
      temperature: temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Return the OpenAI API response to the client
    res.json(response.data);
    
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response?.data || error.message);
    
    // Pass through OpenAI's error response if available
    if (error.response && error.response.data) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({ error: 'Failed to call OpenAI API: ' + error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at:`);
  console.log(`- GET /cases - Get all cases`);
  console.log(`- POST /cases - Create a new case`);
  console.log(`- DELETE /cases/:name - Delete a case by name`);
  console.log(`- PUT /cases/:name - Update a case by name`);
  console.log(`- GET /get-sessions - Get all sessions`);
  console.log(`- POST /save-session - Save a session`);
  console.log(`- DELETE /sessions/:id - Delete a session by ID`);
  console.log(`- DELETE /sessions - Delete all sessions`);
  console.log(`- GET /health - Check server health`);
  console.log(`- POST /api/openai - Proxy for OpenAI API calls`);
}); 