// Event Interface Management
class EventInterface {
    constructor() {
        this.eventData = {
            "event": {
                "title": "Weekly Basketball Game",
                "date": "Saturday, July 12, 2025",
                "time": "3:00 PM - 5:00 PM",
                "location": "Community Sports Center",
                "description": "Join us for our weekly basketball game! All skill levels welcome. Bring your own water bottle and wear comfortable athletic shoes.",
                "votingCutoff": "Friday, July 11, 2025 at 6:00 PM",
                "group": "Basketball Club"
            },
            "attendees": [
                {
                    "id": 1,
                    "name": "Alex Johnson",
                    "response": "Going",
                    "avatar": "AJ"
                },
                {
                    "id": 2,
                    "name": "Sarah Chen",
                    "response": "Going",
                    "avatar": "SC"
                },
                {
                    "id": 3,
                    "name": "Mike Rodriguez",
                    "response": "Maybe",
                    "avatar": "MR"
                },
                {
                    "id": 4,
                    "name": "Emily Davis",
                    "response": "Going",
                    "avatar": "ED"
                },
                {
                    "id": 5,
                    "name": "James Wilson",
                    "response": "Not Going",
                    "avatar": "JW"
                },
                {
                    "id": 6,
                    "name": "Lisa Anderson",
                    "response": "Going",
                    "avatar": "LA"
                },
                {
                    "id": 7,
                    "name": "David Brown",
                    "response": "Maybe",
                    "avatar": "DB"
                },
                {
                    "id": 8,
                    "name": "Jennifer Lee",
                    "response": "Going",
                    "avatar": "JL"
                },
                {
                    "id": 9,
                    "name": "Robert Taylor",
                    "response": "Not Going",
                    "avatar": "RT"
                },
                {
                    "id": 10,
                    "name": "Amanda White",
                    "response": "Going",
                    "avatar": "AW"
                }
            ],
            "currentUser": {
                "id": 11,
                "name": "You",
                "response": null
            }
        };
        
        this.currentFilter = 'all';
        this.countdownInterval = null;
        this.isVotingOpen = true;
        
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.renderAttendees();
        this.updateVoteCounts();
        this.startCountdown();
        this.updateVotingStatus();
    }
    
    bindEventListeners() {
        // Voting buttons
        const voteButtons = document.querySelectorAll('.vote-btn');
        voteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vote = e.currentTarget.dataset.vote;
                this.handleVote(vote);
            });
        });
        
        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });
    }
    
    handleVote(vote) {
        if (!this.isVotingOpen) {
            alert('Voting has closed for this event.');
            return;
        }
        
        // Update current user's vote
        const previousVote = this.eventData.currentUser.response;
        this.eventData.currentUser.response = vote;
        
        // Add or update user in attendees list
        const userIndex = this.eventData.attendees.findIndex(a => a.id === this.eventData.currentUser.id);
        if (userIndex === -1) {
            this.eventData.attendees.push({
                id: this.eventData.currentUser.id,
                name: this.eventData.currentUser.name,
                response: vote,
                avatar: "YU"
            });
        } else {
            this.eventData.attendees[userIndex].response = vote;
        }
        
        // Update UI
        this.updateVoteButtons(vote);
        this.updateVoteCounts();
        this.updateUserVoteStatus(vote);
        this.renderAttendees();
        
        // Simulate real-time update
        this.simulateRealTimeUpdate(vote, previousVote);
    }
    
    updateVoteButtons(selectedVote) {
        const voteButtons = document.querySelectorAll('.vote-btn');
        voteButtons.forEach(btn => {
            const vote = btn.dataset.vote;
            btn.classList.toggle('active', vote === selectedVote);
        });
    }
    
    updateVoteCounts() {
        const counts = this.getVoteCounts();
        
        document.getElementById('goingCount').textContent = counts.Going;
        document.getElementById('maybeCount').textContent = counts.Maybe;
        document.getElementById('notGoingCount').textContent = counts['Not Going'];
        document.getElementById('totalAttendees').textContent = this.eventData.attendees.length;
        
        // Update filter counts
        document.querySelector('[data-filter="all"] .filter-count').textContent = this.eventData.attendees.length;
        document.querySelector('[data-filter="Going"] .filter-count').textContent = counts.Going;
        document.querySelector('[data-filter="Maybe"] .filter-count').textContent = counts.Maybe;
        document.querySelector('[data-filter="Not Going"] .filter-count').textContent = counts['Not Going'];
    }
    
    getVoteCounts() {
        const counts = {
            'Going': 0,
            'Maybe': 0,
            'Not Going': 0
        };
        
        this.eventData.attendees.forEach(attendee => {
            counts[attendee.response]++;
        });
        
        return counts;
    }
    
    updateUserVoteStatus(vote) {
        const statusElement = document.getElementById('userVoteStatus');
        const statusText = statusElement.querySelector('.user-vote-text');
        
        if (vote) {
            statusText.textContent = `You voted: ${vote}`;
            statusElement.classList.add('user-voted');
        } else {
            statusText.textContent = 'Select your response above';
            statusElement.classList.remove('user-voted');
        }
    }
    
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('filter-btn--active', btn.dataset.filter === filter);
        });
        
        this.renderAttendees();
    }
    
    renderAttendees() {
        const attendeesList = document.getElementById('attendeesList');
        let filteredAttendees = this.eventData.attendees;
        
        if (this.currentFilter !== 'all') {
            filteredAttendees = this.eventData.attendees.filter(attendee => 
                attendee.response === this.currentFilter
            );
        }
        
        // Sort attendees: Going first, then Maybe, then Not Going
        const sortOrder = { 'Going': 1, 'Maybe': 2, 'Not Going': 3 };
        filteredAttendees.sort((a, b) => sortOrder[a.response] - sortOrder[b.response]);
        
        attendeesList.innerHTML = filteredAttendees.map(attendee => {
            const responseClass = attendee.response.toLowerCase().replace(' ', '-');
            const responseIcon = this.getResponseIcon(attendee.response);
            
            return `
                <div class="attendee-item">
                    <div class="attendee-avatar">${attendee.avatar}</div>
                    <div class="attendee-info">
                        <div class="attendee-name">${attendee.name}</div>
                    </div>
                    <div class="attendee-response attendee-response--${responseClass}">
                        <span class="attendee-response__icon">${responseIcon}</span>
                        ${attendee.response}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    getResponseIcon(response) {
        const icons = {
            'Going': '✓',
            'Maybe': '?',
            'Not Going': '✗'
        };
        return icons[response] || '';
    }
    
    startCountdown() {
        const votingCutoff = new Date('2025-07-11T18:00:00');
        const countdownElement = document.getElementById('countdown');
        
        this.countdownInterval = setInterval(() => {
            const now = new Date();
            const timeLeft = votingCutoff - now;
            
            if (timeLeft <= 0) {
                this.isVotingOpen = false;
                countdownElement.textContent = 'Voting Closed';
                countdownElement.style.color = 'var(--color-error)';
                this.updateVotingStatus();
                clearInterval(this.countdownInterval);
                return;
            }
            
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            let countdownText = 'Closes in ';
            if (days > 0) {
                countdownText += `${days} day${days > 1 ? 's' : ''}, `;
            }
            countdownText += `${hours} hour${hours > 1 ? 's' : ''}`;
            
            if (days === 0 && hours < 2) {
                countdownText += `, ${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
            
            countdownElement.textContent = countdownText;
        }, 1000);
    }
    
    updateVotingStatus() {
        const statusElement = document.getElementById('votingStatus');
        const statusBadge = statusElement.querySelector('.status');
        const voteButtons = document.querySelectorAll('.vote-btn');
        
        if (this.isVotingOpen) {
            statusBadge.textContent = 'Voting Open';
            statusBadge.className = 'status status--success';
            voteButtons.forEach(btn => btn.disabled = false);
        } else {
            statusBadge.textContent = 'Voting Closed';
            statusBadge.className = 'status status--error';
            voteButtons.forEach(btn => btn.disabled = true);
        }
    }
    
    simulateRealTimeUpdate(vote, previousVote) {
        // Simulate a notification or real-time update
        console.log(`Vote updated: ${previousVote || 'No previous vote'} → ${vote}`);
        
        // Add a subtle animation to the vote count
        const countElement = document.getElementById(vote.replace(' ', '') + 'Count');
        if (countElement) {
            countElement.style.transform = 'scale(1.2)';
            countElement.style.color = 'var(--color-primary)';
            
            setTimeout(() => {
                countElement.style.transform = 'scale(1)';
                countElement.style.color = '';
            }, 300);
        }
    }
}

// Initialize the event interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EventInterface();
});

// Add some interactive animations
document.addEventListener('DOMContentLoaded', () => {
    // Add hover effects to vote buttons
    const voteButtons = document.querySelectorAll('.vote-btn');
    voteButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
        });
    });
    
    // Add click animation to filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
            setTimeout(() => {
                e.currentTarget.style.transform = 'scale(1)';
            }, 100);
        });
    });
    
    // Add entrance animation to attendee items
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe attendee items when they're added to the DOM
    const observeAttendees = () => {
        const attendeeItems = document.querySelectorAll('.attendee-item');
        attendeeItems.forEach(item => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            observer.observe(item);
        });
    };
    
    // Initial observation
    setTimeout(observeAttendees, 100);
    
    // Re-observe when attendees are re-rendered
    const originalRenderAttendees = EventInterface.prototype.renderAttendees;
    EventInterface.prototype.renderAttendees = function() {
        originalRenderAttendees.call(this);
        setTimeout(observeAttendees, 50);
    };
});