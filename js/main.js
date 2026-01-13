// js/main.js - Global JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('AI GAME Platform Loaded');
    
    // Smooth scrolling untuk anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Initialize components berdasarkan halaman
    initializePage();
});

function initializePage() {
    const currentPage = window.location.pathname.split('/').pop();
    
    switch(currentPage) {
        case 'index.html':
        case '':
            // Home page specific initialization
            break;
        case 'prompting.html':
            // Prompting page initialization
            break;
        case 'template.html':
            // Template page initialization
            break;
    }
}