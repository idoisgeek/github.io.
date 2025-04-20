document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const contentSections = document.querySelectorAll('.content-section');
    const caseForm = document.getElementById('caseForm');
    const casesContainer = document.getElementById('casesContainer');
    const casesGrid = document.getElementById('casesGrid');
    const chatPopup = document.getElementById('chatPopup');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const chatTitle = document.getElementById('chatTitle');
    let sortOrder = 'newest';
    let cases = [];
    let currentCase = null;
    let isTyping = false;
    let currentConversation = [];
    let speechSynth = window.speechSynthesis;
    let ttsSupported = false;
    let voices = [];
    let selectedVoice = null;
    let voiceSettings = {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
    };
    
    // API URL - change if your server runs on a different port
    const API_URL = 'http://localhost:3001';

    // Configuration for OpenAI API
    const CONFIG = {
        apiKey: '', // Will be loaded from localStorage if available
        model: 'gpt-3.5-turbo',
        temperature: 0.7
    };

    // Check if CONFIG exists, if not create it with default values
    if (typeof window.CONFIG === 'undefined') {
        window.CONFIG = {
            apiKey: '', // Will be loaded from localStorage if available
            model: 'gpt-3.5-turbo',
            temperature: 0.7
        };
        console.log('Created default CONFIG object');
    }

    // Function to check if all UI components exist
    function checkUIComponents() {
        // Check content sections
        const requiredSections = ['home', 'profile', 'management'];
        let missingSections = [];
        
        requiredSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (!section) {
                missingSections.push(sectionId);
                console.error(`Missing section: ${sectionId}`);
            }
        });
        
        if (missingSections.length > 0) {
            console.error('Missing content sections:', missingSections);
        }
        
        // Make sure the active section is visible
        const activeMenuItem = document.querySelector('.menu-item.active');
        if (activeMenuItem) {
            const contentId = activeMenuItem.getAttribute('data-content');
            const contentSection = document.getElementById(contentId);
            if (contentSection) {
                // Hide all sections first
                document.querySelectorAll('.content-section').forEach(section => {
                    section.style.display = 'none';
                });
                
                // Show the active section
                contentSection.style.display = 'block';
                
                console.log(`Initial section: ${contentId}`);
            }
        }
    }

    // Add typing indicator to chat messages
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatMessages.appendChild(typingIndicator);

    // Function to show/hide typing indicator
    function setTypingIndicator(show) {
        typingIndicator.style.display = show ? 'block' : 'none';
        isTyping = show;
    }

    // Function to save cases to API
    async function saveCases() {
        // This function is no longer needed for batch saves since we save each case individually
        console.log('Individual cases are saved via API');
    }

    // Added chat counter to track recent chats
    let chatSessionCounter = 0;
    
    // Try to load the chat counter from localStorage
    try {
        const savedCounter = localStorage.getItem('chat_session_counter');
        if (savedCounter) {
            chatSessionCounter = parseInt(savedCounter, 10);
        }
    } catch (error) {
        console.error('Error loading chat counter:', error);
    }

    // Function to update stats on the home page
    function updateHomeStats() {
        const totalCasesElement = document.getElementById('totalCases');
        const recentChatsElement = document.getElementById('recentChats');
        
        if (totalCasesElement) {
            totalCasesElement.textContent = cases.length;
        }
        
        // Display the chat session counter
        if (recentChatsElement) {
            recentChatsElement.textContent = chatSessionCounter;
        }
    }

    // Function to increment chat counter
    function incrementChatCounter() {
        chatSessionCounter++;
        localStorage.setItem('chat_session_counter', chatSessionCounter);
        updateHomeStats();
    }

    // Function to load cases from API with localStorage fallback
    async function loadCases() {
        try {
            console.log(`Attempting to fetch cases from ${API_URL}/cases`);
            const response = await fetch(`${API_URL}/cases`);
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                throw new Error(`Failed to fetch cases: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Fetched cases from API:', data);
            cases = data;
            
            // Save to localStorage as backup
            localStorage.setItem('cases_backup', JSON.stringify(cases));
            
            displayCases();
            displayCasesGrid();
            updateHomeStats(); // Update stats after loading cases
        } catch (error) {
            console.error('Error loading cases from API:', error);
            
            // Try to load from localStorage backup
            const backupCases = localStorage.getItem('cases_backup');
            if (backupCases) {
                console.log('Loading cases from localStorage backup');
                cases = JSON.parse(backupCases);
                displayCases();
                displayCasesGrid();
                
                // Show temporary message
                alert('Using cached cases. Connection to server failed: ' + error.message);
            } else {
                // Create default cases if no backup is available
                console.log('No backup cases available, creating default case');
                cases = [{
                    name: 'Example Case',
                    prompt: 'This is an example case. Please create a new case to get started.',
                    timestamp: new Date().toISOString()
                }];
                localStorage.setItem('cases_backup', JSON.stringify(cases));
                displayCases();
                displayCasesGrid();
                alert(`Error loading cases: ${error.message}\nCreated a default case. Please check if the server is running on port 3001.`);
            }
        }
    }

    // Function to add a new case via API with localStorage backup
    async function addCase(newCase) {
        try {
            const response = await fetch(`${API_URL}/cases`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newCase)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to add case: ${response.status}`);
            }
            
            const savedCase = await response.json();
            cases.push(savedCase);
            
            // Save to localStorage backup
            localStorage.setItem('cases_backup', JSON.stringify(cases));
            
            displayCases();
            displayCasesGrid();
            updateHomeStats(); // Update stats after adding a case
            alert('Case created successfully!');
        } catch (error) {
            console.error('Error adding case:', error);
            
            // Add to local array and localStorage as fallback
            cases.push(newCase);
            localStorage.setItem('cases_backup', JSON.stringify(cases));
            displayCases();
            displayCasesGrid();
            updateHomeStats(); // Update stats after adding a case
            
            alert(`Case created and saved locally. Server error: ${error.message}`);
        }
    }

    // Function to delete a case via API with localStorage backup
    async function deleteCase(caseName) {
        try {
            const response = await fetch(`${API_URL}/cases/${encodeURIComponent(caseName)}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete case: ${response.status}`);
            }
            
            // Remove case from local array
            cases = cases.filter(c => c.name !== caseName);
            
            // Update localStorage backup
            localStorage.setItem('cases_backup', JSON.stringify(cases));
            
            displayCases();
            displayCasesGrid();
            updateHomeStats(); // Update stats after deleting a case
            alert('Case deleted successfully');
        } catch (error) {
            console.error('Error deleting case:', error);
            
            // Delete from local array as fallback
            cases = cases.filter(c => c.name !== caseName);
            localStorage.setItem('cases_backup', JSON.stringify(cases));
            displayCases();
            displayCasesGrid();
            updateHomeStats(); // Update stats after deleting a case
            
            alert(`Case deleted locally. Server error: ${error.message}`);
        }
    }

    // Function to call ChatGPT API
    async function callChatGPT(message) {
        try {
            if (!CONFIG.apiKey) {
                // If no API key is provided, show a prompt to enter it
                const apiKey = prompt('Please enter your OpenAI API Key:');
                if (!apiKey) {
                    return "Please provide an API key to use the chat functionality.";
                }
                CONFIG.apiKey = apiKey;
                // Save to localStorage
                localStorage.setItem('openai_config', JSON.stringify({
                    ...JSON.parse(localStorage.getItem('openai_config') || '{}'),
                    apiKey
                }));
            }

            // Create messages array
            const messages = [];
            
            // Add the conversation history (which now includes the system prompt)
            messages.push(...currentConversation);
            
            // Add the current user message
            messages.push({ role: "user", content: message });

            console.log("==== API REQUEST ====");
            console.log("Current conversation:", JSON.stringify(currentConversation));
            console.log("Adding message:", message);
            console.log("Full messages array:", JSON.stringify(messages));
            console.log("====================");

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.apiKey}`
                },
                body: JSON.stringify({
                    model: CONFIG.model,
                    messages: messages,
                    temperature: CONFIG.temperature
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error calling ChatGPT API:', error);
            return "Sorry, I encountered an error: " + error.message;
        }
    }

    // Function to sort cases
    function sortCases() {
        cases.sort((a, b) => {
            const dateA = new Date(a.timestamp);
            const dateB = new Date(b.timestamp);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });
    }

    // Function to filter cases based on search query
    function filterCases(query) {
        return cases.filter(caseItem => 
            caseItem.name.toLowerCase().includes(query.toLowerCase()) ||
            caseItem.prompt.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Function to display cases in grid (home view)
    function displayCasesGrid() {
        if (!casesGrid) return;
        
        casesGrid.innerHTML = '';
        sortCases();
        
        cases.forEach((caseItem, index) => {
            const caseButton = document.createElement('button');
            caseButton.className = 'case-button';
            caseButton.innerHTML = `
                <span class="text-3xl mb-2">📋</span>
                <span class="font-medium text-sm">${truncateText(caseItem.name, 15)}</span>
            `;
            caseButton.title = caseItem.name; // Add tooltip for longer names
            caseButton.onclick = () => {
                incrementChatCounter(); // Increment counter when chat is opened
                openChat(caseItem.name, caseItem.prompt);
            };
            casesGrid.appendChild(caseButton);
        });
    }

    // Helper function to truncate text
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    }

    // Function to display cases in management view
    function displayCases(filteredCases = cases) {
        if (!casesContainer) return;
        
        casesContainer.innerHTML = '';
        
        // Add search and sort controls
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.innerHTML = `
            <div class="search-controls">
                <input type="text" id="searchInput" placeholder="Search cases..." class="search-input">
            </div>
            <div class="sort-controls">
                <label class="text-secondary-600 font-medium">Sort by: </label>
                <select id="sortSelect">
                    <option value="newest" ${sortOrder === 'newest' ? 'selected' : ''}>Newest First</option>
                    <option value="oldest" ${sortOrder === 'oldest' ? 'selected' : ''}>Oldest First</option>
                </select>
            </div>
        `;
        casesContainer.appendChild(controls);

        // Add event listener for search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                const filteredCases = query ? filterCases(query) : cases;
                updateCaseCards(filteredCases);
            });
        }

        // Add event listener for sort select
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                sortOrder = this.value;
                sortCases();
                updateCaseCards(cases);
            });
        }

        sortCases();
        updateCaseCards(filteredCases);
    }

    // Function to update only the case cards
    function updateCaseCards(filteredCases) {
        // Remove existing case cards container if it exists
        const oldCardsContainer = document.querySelector('.case-cards-container');
        if (oldCardsContainer) {
            oldCardsContainer.remove();
        }

        const caseCardsContainer = document.createElement('div');
        caseCardsContainer.className = 'case-cards-container grid grid-cols-1 md:grid-cols-2 gap-4';

        if (filteredCases.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.innerHTML = '<p>No cases found. Create a new case to get started.</p>';
            caseCardsContainer.appendChild(emptyMessage);
        } else {
            filteredCases.forEach((caseItem) => {
                const caseCard = document.createElement('div');
                caseCard.className = 'case-card';
                
                // Get preview of first three lines
                const promptLines = caseItem.prompt.split('\n');
                const previewLines = promptLines.slice(0, 3).join('\n');
                const hasMoreLines = promptLines.length > 3;
                
                caseCard.innerHTML = `
                    <h3 class="case-title">${caseItem.name}</h3>
                    <div class="case-prompt-container">
                        <p class="case-prompt text-sm preview-mode">${previewLines}</p>
                        ${hasMoreLines ? `<p class="case-prompt text-sm full-content hidden">${caseItem.prompt}</p>` : ''}
                        ${hasMoreLines ? `<button class="expand-btn text-xs text-primary-600 hover:text-primary-800 mt-1">Show more</button>` : ''}
                    </div>
                    <p class="timestamp">${new Date(caseItem.timestamp).toLocaleString()}</p>
                    <div class="flex justify-between mt-3">
                        <div class="flex gap-2">
                            <button class="open-case-btn bg-primary-500 hover:bg-primary-600 text-white px-3 py-1 rounded text-sm transition-colors">
                                Open
                            </button>
                            <button class="edit-case-btn bg-secondary-500 hover:bg-secondary-600 text-white px-3 py-1 rounded text-sm transition-colors">
                                Edit
                            </button>
                        </div>
                        <button class="delete-case-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors">
                            Delete
                        </button>
                    </div>
                `;

                // Add event listeners
                caseCard.querySelector('.open-case-btn').addEventListener('click', () => {
                    incrementChatCounter();
                    openChat(caseItem.name, caseItem.prompt);
                });

                // Add edit button listener
                caseCard.querySelector('.edit-case-btn').addEventListener('click', () => {
                    openEditCaseModal(caseItem);
                });

                caseCard.querySelector('.delete-case-btn').addEventListener('click', () => {
                    if (confirm('Are you sure you want to delete this case?')) {
                        deleteCase(caseItem.name);
                    }
                });
                
                // Add show more/less toggle if there are more than 3 lines
                if (hasMoreLines) {
                    const expandBtn = caseCard.querySelector('.expand-btn');
                    expandBtn.addEventListener('click', () => {
                        const previewElem = caseCard.querySelector('.preview-mode');
                        const fullElem = caseCard.querySelector('.full-content');
                        
                        if (previewElem.classList.contains('hidden')) {
                            // Show preview, hide full
                            previewElem.classList.remove('hidden');
                            fullElem.classList.add('hidden');
                            expandBtn.textContent = 'Show more';
                        } else {
                            // Show full, hide preview
                            previewElem.classList.add('hidden');
                            fullElem.classList.remove('hidden');
                            expandBtn.textContent = 'Show less';
                        }
                    });
                }

                caseCardsContainer.appendChild(caseCard);
            });
        }

        // Append to the container after the controls
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.after(caseCardsContainer);
        } else {
            casesContainer.appendChild(caseCardsContainer);
        }
    }

    // Initialize text-to-speech
    function initTTS() {
        ttsSupported = 'speechSynthesis' in window;
        
        if (ttsSupported) {
            // Load available voices
            loadVoices();
            
            // Chrome loads voices asynchronously
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = loadVoices;
            }
        }
    }

    function loadVoices() {
        voices = speechSynthesis.getVoices();
        const voiceSelect = document.getElementById('voiceSelect');
        
        // Clear existing options
        voiceSelect.innerHTML = '';
        
        // Add voices to select
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-index', index);
            voiceSelect.appendChild(option);
        });
        
        // Set default voice (first available)
        if (voices.length > 0) {
            // Try to find previously selected voice
            if (selectedVoice) {
                for (let i = 0; i < voices.length; i++) {
                    if (voices[i].name === selectedVoice.name) {
                        voiceSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // If no previously selected voice or not found, use first one
            if (!selectedVoice || voiceSelect.selectedIndex === -1) {
                selectedVoice = voices[0];
                voiceSelect.selectedIndex = 0;
            }
        }
    }

    function speakText(text) {
        if (!ttsSupported || !text) return;
        
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set voice settings
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        utterance.rate = voiceSettings.rate;
        utterance.pitch = voiceSettings.pitch;
        utterance.volume = voiceSettings.volume;
        
        // Show speech control button
        const speechControlBtn = document.getElementById('speechControlBtn');
        if (speechControlBtn) {
            speechControlBtn.style.display = 'block';
        } else {
            // Create speech control button if it doesn't exist
            const button = document.createElement('button');
            button.id = 'speechControlBtn';
            button.className = 'fixed top-20 right-5 bg-white text-red-500 border border-red-500 rounded-md z-50';
            button.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Reading';
            button.onclick = function() {
                speechSynthesis.cancel();
                this.style.display = 'none';
            };
            document.body.appendChild(button);
        }
        
        // Hide speech control button when done
        utterance.onend = function() {
            const button = document.getElementById('speechControlBtn');
            if (button) {
                button.style.display = 'none';
            }
        };
        
        // Speak the text
        speechSynthesis.speak(utterance);
    }

    function testVoice() {
        const testText = "This is a test of the selected voice and settings. How does it sound?";
        speakText(testText);
    }

    function openVoiceSettingsModal() {
        const modal = document.getElementById('voiceSettingsModal');
        if (!modal) {
            console.error('Voice settings modal not found');
            return;
        }
        modal.style.display = 'block';
        console.log('Opened voice settings modal');
    }

    function closeVoiceSettingsModal() {
        const modal = document.getElementById('voiceSettingsModal');
        if (!modal) {
            console.error('Voice settings modal not found');
            return;
        }
        modal.style.display = 'none';
        console.log('Closed voice settings modal');
    }

    function saveVoiceSettings() {
        const modal = document.getElementById('voiceSettingsModal');
        if (!modal) {
            console.error('Voice settings modal not found');
            return;
        }
        // ... existing code ...
    }

    function loadVoiceSettings() {
        // Load voice settings from localStorage
        const savedSettings = localStorage.getItem('voiceSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            
            voiceSettings.rate = settings.rate || 1.0;
            voiceSettings.pitch = settings.pitch || 1.0;
            voiceSettings.volume = settings.volume || 1.0;
            
            // Restore selected voice (will be completed when voices are loaded)
            if (settings.voiceName) {
                // We'll match this when voices are available
                selectedVoice = { name: settings.voiceName };
            }
        }
    }

    // Function to open chat
    function openChat(caseName, casePrompt) {
        currentCase = { name: caseName, prompt: casePrompt };
        chatPopup.style.display = 'flex'; // Show the chat popup
        chatPopup.classList.add('active');
        chatTitle.textContent = caseName;
        
        // Clear previous chat messages
        chatMessages.innerHTML = '';
        // Add typing indicator back
        chatMessages.appendChild(typingIndicator);
        
        // Reset conversation history and add a system message
        currentConversation = [
            { 
                role: "system", 
                content: `You are an AI assistant helping with a case. Case details: ${casePrompt}` 
            }
        ];
        
        // Send the prompt directly to the API
        setTypingIndicator(true);
        
        // Add initial prompt message to UI but keep it hidden as requested
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user-message initial-prompt';
        userMessageDiv.textContent = "Please help with this case: " + casePrompt;
        userMessageDiv.style.display = 'none'; // Hide the initial prompt
        chatMessages.appendChild(userMessageDiv);
        
        // Call the API directly with the prompt
        callChatGPT(casePrompt).then(response => {
            setTypingIndicator(false);
            
            // Add assistant response to UI
            const assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'message assistant-message';
            assistantMessageDiv.textContent = response;
            assistantMessageDiv.style.display = 'block'; // Ensure response is visible
            chatMessages.appendChild(assistantMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Add to conversation history (don't add the prompt again as it's in system message)
            currentConversation.push({ role: "assistant", content: response });
            
            // Speak the response text
            if (ttsSupported) {
                speakText(response);
            }
        }).catch(error => {
            setTypingIndicator(false);
            
            // Add error message to UI
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.className = 'message assistant-message';
            errorMessageDiv.textContent = "Sorry, I encountered an error. Please try again.";
            errorMessageDiv.style.display = 'block'; // Ensure error is visible
            chatMessages.appendChild(errorMessageDiv);
            
            // Still add the response to conversation history
            currentConversation.push({ role: "assistant", content: "Sorry, I encountered an error. Please try again." });
            
            // Speak the error message
            if (ttsSupported) {
                speakText("Sorry, I encountered an error. Please try again.");
            }
        });
    }

    // Function to close chat
    window.closeChat = function() {
        // Stop any ongoing speech when closing chat
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        chatPopup.classList.remove('active');
        setTimeout(() => {
            chatPopup.style.display = 'none'; // Hide after animation
        }, 300);
        document.body.style.overflow = 'auto';
        currentCase = null;
        currentConversation = [];
    };

    // Function to send message - Fix the visibility of messages
    window.sendMessage = async function() {
        const message = userInput.value.trim();
        if (message && currentCase && !isTyping) {
            // Add user message to UI
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message user-message';
            userMessageDiv.textContent = message;
            userMessageDiv.style.display = 'block'; // Ensure it's visible
            chatMessages.appendChild(userMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Add to conversation history
            currentConversation.push({ role: "user", content: message });
            
            userInput.value = '';
            
            setTypingIndicator(true);
            try {
                const response = await callChatGPT(message);
                setTypingIndicator(false);
                
                // Add assistant response to UI
                const assistantMessageDiv = document.createElement('div');
                assistantMessageDiv.className = 'message assistant-message';
                assistantMessageDiv.textContent = response;
                assistantMessageDiv.style.display = 'block'; // Ensure it's visible
                chatMessages.appendChild(assistantMessageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                // Add to conversation history
                currentConversation.push({ role: "assistant", content: response });
                
                // Speak the response text
                if (ttsSupported) {
                    speakText(response);
                }
            } catch (error) {
                setTypingIndicator(false);
                
                // Add error message to UI
                const errorMessageDiv = document.createElement('div');
                errorMessageDiv.className = 'message assistant-message';
                errorMessageDiv.textContent = "Sorry, I encountered an error. Please try again.";
                chatMessages.appendChild(errorMessageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                // Add to conversation history
                currentConversation.push({ role: "assistant", content: "Sorry, I encountered an error. Please try again." });
                
                // Speak the error message
                if (ttsSupported) {
                    speakText("Sorry, I encountered an error. Please try again.");
                }
            }
        }
    };

    // Handle form submission
    if (caseForm) {
        caseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const caseNameInput = document.getElementById('caseName');
            const casePromptInput = document.getElementById('casePrompt');
            
            if (!caseNameInput || !casePromptInput) {
                console.error('Case form inputs not found');
                alert('Form inputs not found. Please check the HTML structure.');
                return;
            }
            
            const caseName = caseNameInput.value.trim();
            const casePrompt = casePromptInput.value.trim();
            
            if (!caseName || !casePrompt) {
                alert('Please fill in both case name and prompt');
                return;
            }
            
            const newCase = {
                name: caseName,
                prompt: casePrompt,
                timestamp: new Date().toISOString()
            };
            
            // Add case via API instead of directly to the array
            addCase(newCase);
            
            // Reset form
            this.reset();
        });
    }

    // Handle Enter key in chat input
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    // Handle menu navigation
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all menu items
            menuItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked menu item
            item.classList.add('active');
            
            // Get the target content ID
            const contentId = item.getAttribute('data-content');
            
            // Hide all content sections
            const allSections = document.querySelectorAll('.content-section');
            allSections.forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active');
            });
            
            // Show the selected content section
            const contentSection = document.getElementById(contentId);
            if (contentSection) {
                contentSection.style.display = 'block';
                contentSection.classList.add('active');
                
                // Add a small animation
                contentSection.style.opacity = '0';
                setTimeout(() => {
                    contentSection.style.opacity = '1';
                }, 10);

                // If management section is selected, refresh the cases list
                if (contentId === 'management') {
                    displayCases();
                } else if (contentId === 'home') {
                    displayCasesGrid();
                }
                
                console.log(`Changed to section: ${contentId}`);
            } else {
                console.error(`Content section with id ${contentId} not found`);
            }
        });
    });

    // Add configuration button to page
    const configButton = document.createElement('button');
    configButton.className = 'config-button';
    configButton.innerHTML = '⚙️';
    configButton.title = 'API Configuration';
    configButton.addEventListener('click', openApiKeyModal);
    document.body.appendChild(configButton);

    // API Modal Functions
    const apiKeyModal = document.getElementById('apiKeyModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const modelSelect = document.getElementById('modelSelect');
    const temperatureInput = document.getElementById('temperatureInput');
    const temperatureValue = document.getElementById('temperatureValue');
    
    // Find the settings button in the DOM
    const openConfigButton = document.getElementById('openConfigButton');
    if (openConfigButton) {
        // Remove the inline onclick attribute that might not be working
        openConfigButton.removeAttribute('onclick');
        // Add event listener directly
        openConfigButton.addEventListener('click', openApiKeyModal);
    }

    // Load saved configuration
    function loadApiConfig() {
        const savedConfig = JSON.parse(localStorage.getItem('openai_config') || '{}');
        if (savedConfig.apiKey) {
            CONFIG.apiKey = savedConfig.apiKey;
            if (apiKeyInput) apiKeyInput.value = savedConfig.apiKey;
        }
        if (savedConfig.model) {
            CONFIG.model = savedConfig.model;
            if (modelSelect) modelSelect.value = savedConfig.model;
        }
        if (savedConfig.temperature !== undefined) {
            CONFIG.temperature = savedConfig.temperature;
            if (temperatureInput) temperatureInput.value = savedConfig.temperature;
            if (temperatureValue) temperatureValue.textContent = savedConfig.temperature;
        }
    }

    // Update temperature display
    if (temperatureInput && temperatureValue) {
        temperatureInput.addEventListener('input', function() {
            temperatureValue.textContent = this.value;
        });
    }

    // Save API configuration
    window.saveApiConfig = function() {
        console.log("Saving API config");
        try {
            const apiKeyInput = document.getElementById('apiKeyInput');
            const modelSelect = document.getElementById('modelSelect');
            const temperatureInput = document.getElementById('temperatureInput');
            
            if (!apiKeyInput || !modelSelect || !temperatureInput) {
                throw new Error("API config form elements not found");
            }
            
            const apiKey = apiKeyInput.value.trim();
            const model = modelSelect.value;
            const temperature = parseFloat(temperatureInput.value);
            
            // Update CONFIG object
            CONFIG.apiKey = apiKey;
            CONFIG.model = model;
            CONFIG.temperature = temperature;
            
            // Save to localStorage
            localStorage.setItem('openai_config', JSON.stringify({
                apiKey,
                model,
                temperature
            }));
            
            // Close the modal
            window.closeApiKeyModal();
            
            // Check connection
            checkApiConnection();
            
            alert("API configuration saved successfully!");
        } catch (error) {
            console.error("Error saving API config:", error);
            alert("Could not save API settings. Please try again.");
        }
    };

    // Open API configuration modal - Fix this function
    function openApiKeyModal() {
        console.log("Opening API key modal");
        try {
            // Load existing values if available
            const apiKey = localStorage.getItem('apiKey') || CONFIG.apiKey || '';
            const model = localStorage.getItem('model') || CONFIG.model || 'gpt-3.5-turbo';
            const temperature = localStorage.getItem('temperature') || CONFIG.temperature || 0.7;
            
            // Set values in the form
            const apiKeyInput = document.getElementById('apiKeyInput');
            const modelSelect = document.getElementById('modelSelect');
            const temperatureInput = document.getElementById('temperatureInput');
            const temperatureValue = document.getElementById('temperatureValue');
            
            if (apiKeyInput) apiKeyInput.value = apiKey;
            if (modelSelect) modelSelect.value = model;
            if (temperatureInput) temperatureInput.value = temperature;
            if (temperatureValue) temperatureValue.textContent = temperature;
            
            // Show the modal
            const modal = document.getElementById('apiKeyModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.remove('hidden');
            } else {
                throw new Error("API key modal not found");
            }
        } catch (error) {
            console.error("Error opening API key modal:", error);
            alert("Could not open API settings. Please try again.");
        }
    }

    // Close API configuration modal
    window.closeApiKeyModal = function() {
        console.log("Closing API key modal");
        try {
            const modal = document.getElementById('apiKeyModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.add('hidden');
            } else {
                throw new Error("API key modal not found");
            }
        } catch (error) {
            console.error("Error closing API key modal:", error);
        }
    };

    // Show API status
    const statusBar = document.createElement('div');
    statusBar.className = 'api-status';
    statusBar.innerHTML = `
        <p class="m-0">API: <span id="apiStatus" class="font-medium">Checking...</span></p>
        <button id="reconnectButton" class="px-2 py-1 bg-secondary-500 text-white text-xs rounded hover:bg-secondary-600 transition-colors">Reconnect</button>
    `;
    document.body.appendChild(statusBar);
    
    // Add event listener for reconnect button
    document.getElementById('reconnectButton').addEventListener('click', async () => {
        document.getElementById('apiStatus').textContent = 'Connecting...';
        document.getElementById('apiStatus').style.color = '#ffc107';
        
        const isConnected = await checkApiConnection();
        if (isConnected) {
            loadCases();
            alert('Successfully reconnected to the server!');
        } else {
            alert('Failed to connect to the server. Please check if it\'s running.');
        }
    });

    // Check API connection and update status
    async function checkApiConnection() {
        const statusElement = document.getElementById('apiStatus');
        try {
            const response = await fetch(`${API_URL}/health`, { 
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                statusElement.textContent = 'Connected';
                statusElement.style.color = '#28a745';
                console.log('API health check:', data);
                return true;
            } else {
                statusElement.textContent = 'Error';
                statusElement.style.color = '#dc3545';
                return false;
            }
        } catch (error) {
            statusElement.textContent = 'Not Connected';
            statusElement.style.color = '#dc3545';
            console.error('API connection error:', error);
            return false;
        }
    }
    
    // Try to reconnect to API periodically
    setInterval(async () => {
        const wasConnected = document.getElementById('apiStatus').textContent === 'Connected';
        const isConnected = await checkApiConnection();
        
        // If we just reconnected, reload cases from server
        if (!wasConnected && isConnected) {
            console.log('Reconnected to server, reloading cases');
            loadCases();
        }
    }, 10000); // Check every 10 seconds

    // Add keyframe animations
    const keyframes = document.createElement('style');
    keyframes.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(10px); }
        }
    `;
    document.head.appendChild(keyframes);

    // Initialize UI components first
    checkUIComponents();
    
    // Then load data and check connections
    loadApiConfig();
    checkApiConnection();
    loadCases();

    // Function to edit a case
    async function editCase(originalName, updatedCase) {
        console.log('Editing case:', originalName, '->', updatedCase.name);
        try {
            // First, update the case on the server
            const response = await fetch(`${API_URL}/cases/${encodeURIComponent(originalName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedCase)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                throw new Error(errorData.error || `Failed to update case: ${response.status}`);
            }
            
            // Get the updated case from the server
            const savedCase = await response.json();
            console.log('Server returned updated case:', savedCase);
            
            // Update local cases array
            const index = cases.findIndex(c => c.name === originalName);
            if (index !== -1) {
                cases[index] = savedCase;
                console.log('Updated local case at index:', index);
            } else {
                // If the case name changed and we can't find the original, just add it
                cases.push(savedCase);
                console.log('Added new case because original was not found');
            }
            
            // Save to localStorage backup
            localStorage.setItem('cases_backup', JSON.stringify(cases));
            
            // Refresh displays
            displayCases();
            displayCasesGrid();
            updateHomeStats();
            
            alert('Case updated successfully!');
            return true;
        } catch (error) {
            console.error('Error updating case:', error);
            
            // Create a fallback local update
            console.log('Falling back to local update');
            // Update locally if server fails
            const index = cases.findIndex(c => c.name === originalName);
            if (index !== -1) {
                cases[index] = updatedCase;
                localStorage.setItem('cases_backup', JSON.stringify(cases));
                displayCases();
                displayCasesGrid();
                updateHomeStats();
                
                alert(`Case updated locally only. Server error: ${error.message}`);
                return true;
            } else {
                alert(`Failed to update case: Original case "${originalName}" not found.`);
                return false;
            }
        }
    }
    
    // Create Edit Case Modal
    function createEditCaseModal() {
        // Check if modal already exists
        let editModal = document.getElementById('editCaseModal');
        if (editModal) {
            // Remove existing modal to prevent duplicate IDs or event listeners
            editModal.remove();
        }
        
        editModal = document.createElement('div');
        editModal.id = 'editCaseModal';
        editModal.className = 'modal fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center backdrop-blur-sm';
        editModal.style.display = 'none'; // Start hidden, we'll show it later
        editModal.innerHTML = `
            <div class="modal-content glass rounded-2xl shadow-2xl w-11/12 max-w-md max-h-[90vh] overflow-auto animate-fade-in">
                <div class="modal-header flex justify-between items-center p-6 border-b border-gray-200/30">
                    <h3 class="text-xl font-bold text-primary-700">Edit Case</h3>
                    <button id="closeEditModalBtn" class="close-modal text-2xl text-gray-500 hover:text-gray-700 focus:outline-none transition-colors">×</button>
                </div>
                <div class="modal-body p-6 space-y-5">
                    <form id="editCaseForm" class="space-y-6">
                        <input type="hidden" id="originalCaseName">
                        <div class="form-group">
                            <label for="editCaseName" class="block text-sm font-medium text-secondary-700 mb-1">Case Name:</label>
                            <input type="text" id="editCaseName" required
                                class="w-full px-4 py-3 bg-white/80 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors">
                        </div>
                        <div class="form-group">
                            <label for="editCasePrompt" class="block text-sm font-medium text-secondary-700 mb-1">Prompt:</label>
                            <textarea id="editCasePrompt" rows="6" required
                                class="w-full px-4 py-3 bg-white/80 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer border-t border-gray-200/30 p-6 flex justify-end">
                    <button id="cancelEditBtn" class="px-5 py-2.5 bg-gray-400 text-white rounded-lg shadow hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-300 mr-3">
                        Cancel
                    </button>
                    <button id="saveEditBtn" class="px-5 py-2.5 bg-primary-600 text-white rounded-lg shadow hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-300">
                        Save Changes
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(editModal);
        
        // Add direct event listeners instead of using onclick attributes
        document.getElementById('closeEditModalBtn').addEventListener('click', closeEditCaseModal);
        document.getElementById('cancelEditBtn').addEventListener('click', closeEditCaseModal);
        document.getElementById('saveEditBtn').addEventListener('click', submitEditCaseForm);
        
        // Also allow clicking outside the modal to close it
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                closeEditCaseModal();
            }
        });
        
        return editModal;
    }
    
    // Function to open edit case modal
    function openEditCaseModal(caseItem) {
        console.log('Opening edit modal for case:', caseItem.name);
        
        const editModal = createEditCaseModal();
        const originalCaseNameInput = document.getElementById('originalCaseName');
        const editCaseNameInput = document.getElementById('editCaseName');
        const editCasePromptInput = document.getElementById('editCasePrompt');
        
        if (editCaseNameInput && editCasePromptInput && originalCaseNameInput) {
            // Populate form fields
            originalCaseNameInput.value = caseItem.name;
            editCaseNameInput.value = caseItem.name;
            editCasePromptInput.value = caseItem.prompt;
            
            // Show modal
            editModal.style.display = 'flex';
            editModal.style.opacity = '0';
            setTimeout(() => {
                editModal.style.opacity = '1';
            }, 10);
            
            // Focus on the name field
            setTimeout(() => {
                editCaseNameInput.focus();
            }, 100);
        } else {
            console.error('Edit form elements not found');
            alert('Could not open edit form. Please try again.');
        }
    }
    
    // Function to close edit case modal
    function closeEditCaseModal() {
        console.log('Closing edit modal');
        const editModal = document.getElementById('editCaseModal');
        if (editModal) {
            editModal.style.opacity = '0';
            setTimeout(() => {
                editModal.style.display = 'none';
            }, 300);
        } else {
            console.error('Edit modal not found for closing');
        }
    }
    
    // Function to submit edit case form
    function submitEditCaseForm() {
        console.log('Submitting edit form');
        const originalCaseName = document.getElementById('originalCaseName').value;
        const caseName = document.getElementById('editCaseName').value.trim();
        const casePrompt = document.getElementById('editCasePrompt').value.trim();
        
        if (!caseName || !casePrompt) {
            alert('Please fill in both case name and prompt');
            return;
        }
        
        // Find the original case to preserve timestamp
        const originalCase = cases.find(c => c.name === originalCaseName);
        if (!originalCase) {
            alert('Case not found. Please try again.');
            return;
        }
        
        // Create updated case object, keeping original timestamp
        const updatedCase = {
            name: caseName,
            prompt: casePrompt,
            timestamp: originalCase.timestamp
        };
        
        // Update case
        editCase(originalCaseName, updatedCase);
        
        // Close modal
        closeEditCaseModal();
    }
    
    // Make these functions available to the window
    window.closeEditCaseModal = closeEditCaseModal;
    window.submitEditCaseForm = submitEditCaseForm;

    // Initialize TTS
    initTTS();
    
    // Load voice settings
    loadVoiceSettings();
    
    // Add event listeners
    initEventListeners();
});

function initEventListeners() {
    // Navigation event listeners for menu items
    const menuItems = document.querySelectorAll('.menu-item');
    const contentSections = document.querySelectorAll('.content-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const contentId = this.getAttribute('data-content');
            
            // Remove active class from all menu items
            menuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Hide all content sections
            contentSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show the selected content section
            document.getElementById(contentId).style.display = 'block';
        });
    });
    
    // Voice settings button
    const voiceSettingsBtn = document.getElementById('voiceSettingsButton');
    if (voiceSettingsBtn) {
        voiceSettingsBtn.addEventListener('click', function() {
            console.log('Voice Settings Button Clicked');
            window.openVoiceSettingsModal();
        });
    }
    
    // API settings button
    const openConfigBtn = document.getElementById('openConfigButton');
    if (openConfigBtn) {
        openConfigBtn.addEventListener('click', function() {
            console.log('API Settings Button Clicked');
            window.openApiKeyModal();
        });
    }
    
    // Close voice settings modal
    const closeVoiceSettingsBtn = document.querySelector('#voiceSettingsModal .close-modal');
    if (closeVoiceSettingsBtn) {
        closeVoiceSettingsBtn.addEventListener('click', function() {
            window.closeVoiceSettingsModal();
        });
    }
    
    // Close API settings modal
    const closeApiKeyBtn = document.querySelector('#apiKeyModal .close-modal');
    if (closeApiKeyBtn) {
        closeApiKeyBtn.addEventListener('click', function() {
            window.closeApiKeyModal();
        });
    }
    
    // Save voice settings
    const saveVoiceSettingsBtn = document.querySelector('#voiceSettingsModal .modal-footer button');
    if (saveVoiceSettingsBtn) {
        saveVoiceSettingsBtn.addEventListener('click', function() {
            window.saveVoiceSettings();
        });
    }
    
    // Save API settings
    const saveApiConfigBtn = document.querySelector('#apiKeyModal .modal-footer button');
    if (saveApiConfigBtn) {
        saveApiConfigBtn.addEventListener('click', function() {
            window.saveApiConfig();
        });
    }
    
    // Case form
    const caseForm = document.getElementById('caseForm');
    if (caseForm) {
        caseForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const caseName = document.getElementById('caseName').value.trim();
            const casePrompt = document.getElementById('casePrompt').value.trim();
            
            if (!caseName || !casePrompt) {
                alert('Please fill in both case name and prompt');
                return;
            }
            
            const newCase = {
                name: caseName, 
                prompt: casePrompt,
                timestamp: new Date().toISOString()
            };
            
            addCase(newCase);
            
            // Reset form
            this.reset();
        });
    }
    
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            sortOrder = this.value;
            sortCases();
            updateCaseCards(cases);
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            const filteredCases = query ? filterCases(query) : cases;
            updateCaseCards(filteredCases);
        });
    }
    
    // Voice settings modal inputs
    const rateInput = document.getElementById('rateInput');
    if (rateInput) {
        rateInput.addEventListener('input', function() {
            const rateValue = parseFloat(this.value);
            document.getElementById('rateValue').textContent = rateValue.toFixed(1);
            voiceSettings.rate = rateValue;
        });
    }
    
    const pitchInput = document.getElementById('pitchInput');
    if (pitchInput) {
        pitchInput.addEventListener('input', function() {
            const pitchValue = parseFloat(this.value);
            document.getElementById('pitchValue').textContent = pitchValue.toFixed(1);
            voiceSettings.pitch = pitchValue;
        });
    }
    
    const volumeInput = document.getElementById('volumeInput');
    if (volumeInput) {
        volumeInput.addEventListener('input', function() {
            const volumeValue = parseFloat(this.value);
            document.getElementById('volumeValue').textContent = volumeValue.toFixed(1);
            voiceSettings.volume = volumeValue;
        });
    }
    
    // Temperature input for API settings
    const temperatureInput = document.getElementById('temperatureInput');
    if (temperatureInput) {
        temperatureInput.addEventListener('input', function() {
            const tempValue = parseFloat(this.value);
            document.getElementById('temperatureValue').textContent = tempValue.toFixed(1);
        });
    }
    
    // Test voice button
    const testVoiceBtn = document.getElementById('testVoiceButton');
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', function() {
            console.log('Test Voice Button Clicked');
            window.testVoice();
        });
    }
    
    // Voice select change
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            const selectedIndex = this.selectedIndex;
            if (selectedIndex >= 0 && voices.length > 0) {
                selectedVoice = voices[selectedIndex];
            }
        });
    }
}

// Make these functions available globally with improved error handling
window.openVoiceSettingsModal = function() {
    const modal = document.getElementById('voiceSettingsModal');
    if (!modal) {
        console.error('Voice settings modal not found');
        return;
    }
    modal.style.display = 'block';
    console.log('Opened voice settings modal');
}

window.closeVoiceSettingsModal = function() {
    const modal = document.getElementById('voiceSettingsModal');
    if (!modal) {
        console.error('Voice settings modal not found');
        return;
    }
    modal.style.display = 'none';
    console.log('Closed voice settings modal');
}

window.saveVoiceSettings = function() {
    const modal = document.getElementById('voiceSettingsModal');
    if (!modal) {
        console.error('Voice settings modal not found');
        return;
    }
    // ... existing code ...
}

window.openApiKeyModal = function() {
    console.log("Opening API key modal");
    try {
        // Load existing values if available
        const apiKey = localStorage.getItem('apiKey') || CONFIG.apiKey || '';
        const model = localStorage.getItem('model') || CONFIG.model || 'gpt-3.5-turbo';
        const temperature = localStorage.getItem('temperature') || CONFIG.temperature || 0.7;
        
        // Set values in the form
        const apiKeyInput = document.getElementById('apiKeyInput');
        const modelSelect = document.getElementById('modelSelect');
        const temperatureInput = document.getElementById('temperatureInput');
        const temperatureValue = document.getElementById('temperatureValue');
        
        if (apiKeyInput) apiKeyInput.value = apiKey;
        if (modelSelect) modelSelect.value = model;
        if (temperatureInput) temperatureInput.value = temperature;
        if (temperatureValue) temperatureValue.textContent = temperature;
        
        // Show the modal
        const modal = document.getElementById('apiKeyModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
        } else {
            throw new Error("API key modal not found");
        }
    } catch (error) {
        console.error("Error opening API key modal:", error);
        alert("Could not open API settings. Please try again.");
    }
};

window.closeApiKeyModal = function() {
    console.log("Closing API key modal");
    try {
        const modal = document.getElementById('apiKeyModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        } else {
            throw new Error("API key modal not found");
        }
    } catch (error) {
        console.error("Error closing API key modal:", error);
    }
};

window.saveApiConfig = function() {
    console.log("Saving API config");
    try {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const modelSelect = document.getElementById('modelSelect');
        const temperatureInput = document.getElementById('temperatureInput');
        
        if (!apiKeyInput || !modelSelect || !temperatureInput) {
            throw new Error("API config form elements not found");
        }
        
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;
        const temperature = parseFloat(temperatureInput.value);
        
        // Update CONFIG object
        CONFIG.apiKey = apiKey;
        CONFIG.model = model;
        CONFIG.temperature = temperature;
        
        // Save to localStorage
        localStorage.setItem('openai_config', JSON.stringify({
            apiKey,
            model,
            temperature
        }));
        
        // Close the modal
        window.closeApiKeyModal();
        
        // Check connection
        checkApiConnection();
        
        alert("API configuration saved successfully!");
    } catch (error) {
        console.error("Error saving API config:", error);
        alert("Could not save API settings. Please try again.");
    }
};

// Add testVoice to the global window object
window.testVoice = function() {
    console.log("Testing voice settings");
    try {
        // Create a sample test sentence
        const testText = "This is a test of the selected voice and settings. How does it sound?";
        
        // Check if speech synthesis is supported
        if (!window.speechSynthesis) {
            throw new Error("Speech synthesis is not supported in this browser");
        }
        
        // Use the speakText function to speak the test message
        speakText(testText);
        
    } catch (error) {
        console.error("Error testing voice:", error);
        alert("Could not test voice. Speech synthesis might not be supported in your browser.");
    }
};

