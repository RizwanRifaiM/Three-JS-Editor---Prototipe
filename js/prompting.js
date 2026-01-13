// js/prompting.js - Prompting page JavaScript
import { GoogleGenerativeAI } from '@google/generative-ai';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Prompting page loaded');
    setupPrompting();
});

function setupPrompting() {
    const generateBtn = document.querySelector('.generate-btn');
    const promptInput = document.querySelector('.prompt-input');
    const viewToggles = document.querySelectorAll('.view-toggle');
    const copyBtn = document.getElementById('copy-btn');
    const editBtn = document.getElementById('edit-btn');
    
    generateBtn.addEventListener('click', generateGame);
    copyBtn.addEventListener('click', copyCode);
    editBtn.addEventListener('click', editInEditor);
    
    viewToggles.forEach(toggle => {
        toggle.addEventListener('click', switchView);
    });
    
    // Auto-resize textarea
    promptInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

function switchView(e) {
    const view = e.target.dataset.view;
    const viewToggles = document.querySelectorAll('.view-toggle');
    const codeView = document.querySelector('.code-view');
    const previewView = document.querySelector('.preview-view');
    
    // Update toggle buttons
    viewToggles.forEach(toggle => {
        toggle.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Switch views
    if (view === 'code') {
        codeView.classList.add('active');
        previewView.classList.remove('active');
    } else {
        codeView.classList.remove('active');
        previewView.classList.add('active');
    }
}

async function generateGame() {
    const promptInput = document.querySelector('.prompt-input');
    const languageSelect = document.querySelector('.language-dropdown');
    const apiKeyInput = document.querySelector('.api-key-input');
    const generateBtn = document.querySelector('.generate-btn');
    const outputSection = document.getElementById('output-section');
    const codeOutput = document.getElementById('code-output');
    
    const prompt = promptInput.value.trim();
    const language = languageSelect.value;
    const apiKey = apiKeyInput.value.trim();
    
    if (prompt === '') {
        alert('Please enter a game prompt!');
        return;
    }
    
    if (apiKey === '') {
        alert('Please enter your Gemini API key!');
        return;
    }
    
    // Show loading state
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    
    try {
        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Create enhanced prompt - only functional code, no explanations
        const systemPrompt = `You are an expert game developer. Generate ONLY the complete, runnable ${language} code for the game described below. Do not include any explanations, comments about the code, or text outside of the code itself. The code should be immediately executable and include all necessary imports/dependencies.`;
        
        const fullPrompt = `${systemPrompt}\n\nGame Description: ${prompt}`;
        
        // Generate content
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        let generatedCode = response.text();
        
        // Clean up the code (remove any markdown code blocks if present)
        generatedCode = generatedCode.replace(/```[\w]*\n?/g, '').trim();
        
        // Display the generated code
        codeOutput.textContent = generatedCode;
        
        // Generate preview if possible
        generatePreview(generatedCode, language);
        
        // Switch to code view initially
        switchToCodeView();
        
    } catch (error) {
        console.error('Error generating game:', error);
        alert('Error generating game: ' + error.message);
    } finally {
        // Reset button
        generateBtn.textContent = 'Generate Game';
        generateBtn.disabled = false;
    }
}

function generatePreview(code, language) {
    const previewFrame = document.getElementById('game-preview');
    
    if (language === 'javascript' || language === 'threejs') {
        // Create HTML content with the JavaScript code
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; overflow: hidden; background: #000; }
        canvas { display: block; }
    </style>
    ${language === 'threejs' ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>' : ''}
</head>
<body>
    <script>
        ${code}
    </script>
</body>
</html>`;
        
        // Set the iframe content
        previewFrame.srcdoc = htmlContent;
    } else {
        // For other languages, show a message
        const message = `Preview not available for ${language}. Only JavaScript and Three.js games can be previewed directly in the browser.`;
        previewFrame.srcdoc = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            margin: 0; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            background: #1a1a1a; 
            color: white; 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px; 
        }
    </style>
</head>
<body>
    <div>${message}</div>
</body>
</html>`;
    }
}

function switchToCodeView() {
    const codeToggle = document.querySelector('.view-toggle[data-view="code"]');
    if (codeToggle) {
        codeToggle.click();
    }
}

function copyCode() {
    const codeOutput = document.getElementById('code-output');
    navigator.clipboard.writeText(codeOutput.textContent).then(() => {
        alert('Code copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy code:', err);
        alert('Failed to copy code');
    });
}

function editInEditor() {
    const codeOutput = document.getElementById('code-output');
    // Store the code in localStorage to pass to editor
    localStorage.setItem('generatedCode', codeOutput.textContent);
    // Redirect to editor
    window.location.href = 'editor.html';
}