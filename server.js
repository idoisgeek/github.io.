const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const CASES_FILE = path.join(process.cwd(), 'cases.json');

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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at:`);
  console.log(`- GET /cases - Get all cases`);
  console.log(`- POST /cases - Create a new case`);
  console.log(`- DELETE /cases/:name - Delete a case by name`);
  console.log(`- PUT /cases/:name - Update a case by name`);
}); 
