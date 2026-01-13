// js/home.js - Home page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Home page loaded');
    
    // Tambahkan animasi untuk buttons
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.05)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
});