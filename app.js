// app.js

// Function to toggle password visibility
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('togglePassword');
    toggleButton.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
    });
}

// Function to handle Enter key support
function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        login();  // Assuming login is the function to handle the login logic
    }
}

// Improved error handling
function handleError(error) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = error.message || 'An unexpected error occurred.';
    errorMessage.classList.remove('hidden');
}

// Function to show app section after login
function showAppSection() {
    const appSection = document.getElementById('appSection');
    appSection.classList.remove('hidden');
}

// Initialize functions
document.addEventListener('DOMContentLoaded', function () {
    togglePasswordVisibility();
    document.getElementById('password').addEventListener('keypress', handleEnterKey);
});