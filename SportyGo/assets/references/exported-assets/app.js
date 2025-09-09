// Game Session Form Management
class GameSessionForm {
    constructor() {
        this.form = document.getElementById('gameSessionForm');
        this.successMessage = document.getElementById('successMessage');
        this.submitBtn = document.getElementById('submitBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.createAnotherBtn = document.getElementById('createAnotherBtn');
        this.viewSessionsBtn = document.getElementById('viewSessionsBtn');
        
        this.groups = [
            "Basketball Club",
            "Chess Club", 
            "Gaming Group",
            "Soccer Team",
            "Board Game Society",
            "Esports Club",
            "Tennis Club",
            "Volleyball Group"
        ];
        
        this.init();
    }
    
    init() {
        this.populateGroups();
        this.setDefaultDates();
        this.bindEvents();
    }
    
    populateGroups() {
        const groupSelect = document.getElementById('group');
        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            groupSelect.appendChild(option);
        });
    }
    
    setDefaultDates() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Set minimum date to today
        document.getElementById('gameDate').min = today.toISOString().split('T')[0];
        document.getElementById('votingCutoff').min = today.toISOString().split('T')[0];
        
        // Set default game date to tomorrow
        document.getElementById('gameDate').value = tomorrow.toISOString().split('T')[0];
        
        // Set default voting cutoff to today
        document.getElementById('votingCutoff').value = today.toISOString().split('T')[0];
    }
    
    bindEvents() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.cancelBtn.addEventListener('click', this.handleCancel.bind(this));
        this.createAnotherBtn.addEventListener('click', this.handleCreateAnother.bind(this));
        this.viewSessionsBtn.addEventListener('click', this.handleViewSessions.bind(this));
        
        // Real-time validation
        const inputs = this.form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearError(input));
        });
        
        // Custom validation for date logic
        document.getElementById('gameDate').addEventListener('change', this.validateDates.bind(this));
        document.getElementById('votingCutoff').addEventListener('change', this.validateDates.bind(this));
    }
    
    validateField(field) {
        const fieldName = field.name;
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        // Check if field is required and empty
        if (field.required && !value) {
            isValid = false;
            errorMessage = `${this.getFieldLabel(fieldName)} is required`;
        }
        
        // Additional validation based on field type
        if (isValid && value) {
            switch (fieldName) {
                case 'gameDate':
                    if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
                        isValid = false;
                        errorMessage = 'Game date cannot be in the past';
                    }
                    break;
                    
                case 'votingCutoff':
                    if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
                        isValid = false;
                        errorMessage = 'Voting cutoff cannot be in the past';
                    }
                    break;
                    
                case 'location':
                    if (value.length < 3) {
                        isValid = false;
                        errorMessage = 'Location must be at least 3 characters';
                    }
                    break;
            }
        }
        
        this.showError(field, isValid ? '' : errorMessage);
        return isValid;
    }
    
    validateDates() {
        const gameDate = document.getElementById('gameDate').value;
        const votingCutoff = document.getElementById('votingCutoff').value;
        
        if (gameDate && votingCutoff) {
            const gameDateObj = new Date(gameDate);
            const votingCutoffObj = new Date(votingCutoff);
            
            if (votingCutoffObj > gameDateObj) {
                this.showError(document.getElementById('votingCutoff'), 'Voting cutoff must be before or on the game date');
                return false;
            }
        }
        
        return true;
    }
    
    validateForm() {
        let isValid = true;
        const inputs = this.form.querySelectorAll('input[required], select[required]');
        
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        // Additional date validation
        if (!this.validateDates()) {
            isValid = false;
        }
        
        return isValid;
    }
    
    showError(field, message) {
        const errorElement = document.getElementById(field.name + 'Error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.toggle('show', !!message);
            field.classList.toggle('error', !!message);
        }
    }
    
    clearError(field) {
        const errorElement = document.getElementById(field.name + 'Error');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
            field.classList.remove('error');
        }
    }
    
    clearAllErrors() {
        const errorElements = this.form.querySelectorAll('.error-message');
        const inputElements = this.form.querySelectorAll('.form-control');
        
        errorElements.forEach(element => {
            element.textContent = '';
            element.classList.remove('show');
        });
        
        inputElements.forEach(element => {
            element.classList.remove('error');
        });
    }
    
    getFieldLabel(fieldName) {
        const labels = {
            gameDate: 'Game Date',
            gameTime: 'Game Time',
            location: 'Location',
            votingCutoff: 'Voting Cutoff Date',
            group: 'Group'
        };
        return labels[fieldName] || fieldName;
    }
    
    getFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }
        
        // Show loading state
        this.submitBtn.disabled = true;
        this.submitBtn.classList.add('btn--loading');
        
        try {
            // Simulate API call
            await this.simulateApiCall();
            
            // Get form data for success message
            const formData = this.getFormData();
            
            // Hide form and show success message
            this.form.style.display = 'none';
            this.successMessage.classList.remove('hidden');
            
            // Log the session data (in a real app, this would be sent to server)
            console.log('Game session created:', formData);
            
        } catch (error) {
            console.error('Error creating game session:', error);
            // In a real app, show error message to user
            alert('Error creating game session. Please try again.');
        } finally {
            // Reset loading state
            this.submitBtn.disabled = false;
            this.submitBtn.classList.remove('btn--loading');
        }
    }
    
    async simulateApiCall() {
        // Simulate network delay
        return new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    handleCancel() {
        if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
            this.resetForm();
        }
    }
    
    handleCreateAnother() {
        this.successMessage.classList.add('hidden');
        this.form.style.display = 'block';
        this.resetForm();
    }
    
    handleViewSessions() {
        // In a real app, this would navigate to the sessions list
        alert('Redirecting to sessions list...');
    }
    
    resetForm() {
        this.form.reset();
        this.clearAllErrors();
        this.setDefaultDates();
        
        // Reset submit button state
        this.submitBtn.disabled = false;
        this.submitBtn.classList.remove('btn--loading');
    }
}

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameSessionForm();
});