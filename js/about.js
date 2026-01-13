// js/about.js - About page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('About page loaded');
    initializeAnimations();
    setupInteractiveElements();
});

function initializeAnimations() {
    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all workflow steps and feature cards
    const animatedElements = document.querySelectorAll('.workflow-step, .feature-card, .language-card');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

function setupInteractiveElements() {
    // Add hover effects to genre items
    const genreItems = document.querySelectorAll('.genre-item');
    genreItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(255, 255, 255, 0.12)';
            this.style.borderColor = 'rgba(143, 171, 212, 0.3)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(255, 255, 255, 0.08)';
            this.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        });
    });

    // Add click effects to workflow steps
    const workflowSteps = document.querySelectorAll('.workflow-step');
    workflowSteps.forEach(step => {
        step.addEventListener('click', function() {
            this.style.transform = 'translateY(-8px) scale(1.02)';
            setTimeout(() => {
                this.style.transform = 'translateY(-8px) scale(1)';
            }, 150);
        });
    });

    // Add parallax effect to header
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const header = document.querySelector('.main-header');
        header.style.transform = `translateY(${scrolled * 0.5}px)`;
    });
}

// Add some fun interactive features
function addFunFeatures() {
    // Random emoji animation
    const emojis = ['🎮', '🚀', '💡', '🌟', '⚡', '🎯'];
    const containers = document.querySelectorAll('.workflow-step, .feature-card');
    
    containers.forEach(container => {
        container.addEventListener('mouseenter', function() {
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const floatingEmoji = document.createElement('div');
            floatingEmoji.textContent = randomEmoji;
            floatingEmoji.style.position = 'absolute';
            floatingEmoji.style.fontSize = '2rem';
            floatingEmoji.style.opacity = '0';
            floatingEmoji.style.animation = 'floatUp 1s ease-out forwards';
            
            const rect = this.getBoundingClientRect();
            floatingEmoji.style.left = Math.random() * (rect.width - 40) + 'px';
            floatingEmoji.style.top = '20px';
            
            this.style.position = 'relative';
            this.appendChild(floatingEmoji);
            
            setTimeout(() => {
                floatingEmoji.remove();
            }, 1000);
        });
    });
}

// Add CSS for floating animation
const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        0% {
            opacity: 0;
            transform: translateY(0) scale(0.5);
        }
        50% {
            opacity: 1;
            transform: translateY(-20px) scale(1);
        }
        100% {
            opacity: 0;
            transform: translateY(-40px) scale(0.5);
        }
    }
`;
document.head.appendChild(style);

// Initialize fun features
document.addEventListener('DOMContentLoaded', addFunFeatures);