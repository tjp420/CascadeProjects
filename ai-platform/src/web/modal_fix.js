// Immediate Modal Fix - Run this to close stuck modals
(function() {
    console.log('Applying modal fix...');
    
    // Remove any existing drill-down modals
    const modals = document.querySelectorAll('.drill-down-modal');
    modals.forEach(modal => {
        console.log('Removing stuck modal:', modal);
        modal.remove();
    });
    
    // Add global close function
    window.forceCloseModal = function() {
        const modals = document.querySelectorAll('.drill-down-modal');
        modals.forEach(modal => modal.remove());
        console.log('Force closed all modals');
    };
    
    // Add click listener to close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('drill-down-modal')) {
            e.target.remove();
            console.log('Modal closed by backdrop click');
        }
    });
    
    // Add escape key listener
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            window.forceCloseModal();
        }
    });
    
    console.log('Modal fix applied successfully!');
})();
