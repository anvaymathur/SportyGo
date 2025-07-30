// Mobile Event Application JavaScript

// Application data
const eventData = {
  event: {
    title: "Weekly Basketball Game",
    date: "Saturday, July 12, 2025",
    time: "3:00 PM - 5:00 PM",
    location: "Community Sports Center",
    votingCutoff: "Friday, July 11, 2025 at 6:00 PM",
    description: "Join us for our weekly basketball game! All skill levels welcome. Bring water and appropriate athletic wear."
  },
  attendees: [
    {name: "Alex Chen", status: "going", avatar: "AC"},
    {name: "Sarah Wilson", status: "going", avatar: "SW"},
    {name: "Mike Johnson", status: "going", avatar: "MJ"},
    {name: "Emma Davis", status: "going", avatar: "ED"},
    {name: "Tom Rodriguez", status: "maybe", avatar: "TR"},
    {name: "Lisa Zhang", status: "maybe", avatar: "LZ"},
    {name: "David Kim", status: "maybe", avatar: "DK"},
    {name: "Rachel Brown", status: "not_going", avatar: "RB"},
    {name: "James Miller", status: "not_going", avatar: "JM"}
  ],
  currentUser: {
    name: "You",
    status: null
  }
};

// Application state
let currentFilter = 'all';
let userVote = null;
let isRefreshing = false;

// DOM elements
const elements = {
  descriptionToggle: document.getElementById('descriptionToggle'),
  descriptionContent: document.getElementById('descriptionContent'),
  attendeesList: document.getElementById('attendeesList'),
  filterChips: document.querySelectorAll('.filter-chip'),
  votingButtons: document.querySelectorAll('.voting-btn'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
  pullRefresh: document.getElementById('pullRefresh'),
  countdown: {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes')
  },
  counts: {
    going: document.getElementById('goingCount'),
    maybe: document.getElementById('maybeCount'),
    notGoing: document.getElementById('notGoingCount'),
    goingBtn: document.getElementById('goingBtnCount'),
    maybeBtn: document.getElementById('maybeBtnCount'),
    notGoingBtn: document.getElementById('notGoingBtnCount')
  }
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

function initializeApp() {
  setupEventListeners();
  renderAttendees();
  updateCounts();
  startCountdown();
  setupPullToRefresh();
  setupTouchFeedback();
}

// Event listeners setup
function setupEventListeners() {
  // Description toggle
  elements.descriptionToggle.addEventListener('click', toggleDescription);
  
  // Filter chips
  elements.filterChips.forEach(chip => {
    chip.addEventListener('click', () => filterAttendees(chip.dataset.filter));
  });
  
  // Voting buttons
  elements.votingButtons.forEach(button => {
    button.addEventListener('click', () => handleVote(button.dataset.status));
  });
  
  // Back button
  document.querySelector('.header__back-btn').addEventListener('click', () => {
    // Simulate navigation back
    showToast('Going back...');
  });
}

// Description toggle functionality
function toggleDescription() {
  const content = elements.descriptionContent;
  const toggle = elements.descriptionToggle;
  
  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    toggle.classList.remove('expanded');
  } else {
    content.classList.add('expanded');
    toggle.classList.add('expanded');
  }
}

// Render attendees list
function renderAttendees() {
  const attendeesList = elements.attendeesList;
  attendeesList.innerHTML = '';
  
  eventData.attendees.forEach(attendee => {
    const attendeeElement = createAttendeeElement(attendee);
    attendeesList.appendChild(attendeeElement);
  });
}

// Create attendee element
function createAttendeeElement(attendee) {
  const div = document.createElement('div');
  div.className = `attendee attendee--${attendee.status}`;
  div.dataset.status = attendee.status;
  
  const statusText = attendee.status === 'not_going' ? 'not going' : attendee.status;
  
  div.innerHTML = `
    <div class="attendee__avatar attendee__avatar--${attendee.status}">
      ${attendee.avatar}
    </div>
    <div class="attendee__info">
      <div class="attendee__name">${attendee.name}</div>
      <div class="attendee__status">
        <div class="attendee__status-dot attendee__status-dot--${attendee.status}"></div>
        <span class="attendee__status-text">${statusText}</span>
      </div>
    </div>
  `;
  
  return div;
}

// Filter attendees
function filterAttendees(filter) {
  currentFilter = filter;
  
  // Update active filter chip
  elements.filterChips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  
  // Show/hide attendees
  const attendees = document.querySelectorAll('.attendee');
  attendees.forEach(attendee => {
    const shouldShow = filter === 'all' || attendee.dataset.status === filter;
    attendee.classList.toggle('hidden', !shouldShow);
  });
  
  // Add smooth animation
  setTimeout(() => {
    attendees.forEach(attendee => {
      if (!attendee.classList.contains('hidden')) {
        attendee.style.animation = 'slideIn 0.3s ease-out';
      }
    });
  }, 50);
}

// Handle voting
function handleVote(status) {
  if (userVote === status) {
    // Remove vote if clicking the same button
    userVote = null;
    showToast('Vote removed');
  } else {
    // Set new vote
    userVote = status;
    const statusText = status === 'not_going' ? 'not going' : status;
    showToast(`Voted: ${statusText}`);
  }
  
  // Update button states
  elements.votingButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.status === userVote);
  });
  
  // Simulate haptic feedback
  simulateHapticFeedback();
  
  // Update counts (simulate adding user vote)
  updateCounts();
}

// Update counts
function updateCounts() {
  const counts = {
    going: eventData.attendees.filter(a => a.status === 'going').length,
    maybe: eventData.attendees.filter(a => a.status === 'maybe').length,
    not_going: eventData.attendees.filter(a => a.status === 'not_going').length
  };
  
  // Add user vote to counts
  if (userVote) {
    counts[userVote]++;
  }
  
  // Update UI
  elements.counts.going.textContent = counts.going;
  elements.counts.maybe.textContent = counts.maybe;
  elements.counts.notGoing.textContent = counts.not_going;
  elements.counts.goingBtn.textContent = counts.going;
  elements.counts.maybeBtn.textContent = counts.maybe;
  elements.counts.notGoingBtn.textContent = counts.not_going;
}

// Countdown timer
function startCountdown() {
  const targetDate = new Date('Friday, July 11, 2025 18:00:00').getTime();
  
  function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;
    
    if (distance < 0) {
      elements.countdown.days.textContent = '0';
      elements.countdown.hours.textContent = '0';
      elements.countdown.minutes.textContent = '0';
      return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    
    elements.countdown.days.textContent = days;
    elements.countdown.hours.textContent = hours;
    elements.countdown.minutes.textContent = minutes;
  }
  
  updateCountdown();
  setInterval(updateCountdown, 60000); // Update every minute
}

// Toast notification
function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toast.classList.add('show');
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// Pull to refresh functionality
function setupPullToRefresh() {
  let startY = 0;
  let currentY = 0;
  let isRefreshing = false;
  
  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
    }
  });
  
  document.addEventListener('touchmove', (e) => {
    if (window.scrollY === 0 && !isRefreshing) {
      currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;
      
      if (pullDistance > 100) {
        elements.pullRefresh.classList.add('show');
      } else {
        elements.pullRefresh.classList.remove('show');
      }
    }
  });
  
  document.addEventListener('touchend', () => {
    if (window.scrollY === 0 && !isRefreshing) {
      const pullDistance = currentY - startY;
      
      if (pullDistance > 100) {
        triggerRefresh();
      } else {
        elements.pullRefresh.classList.remove('show');
      }
    }
  });
}

// Trigger refresh
function triggerRefresh() {
  if (isRefreshing) return;
  
  isRefreshing = true;
  
  // Simulate refresh
  setTimeout(() => {
    elements.pullRefresh.classList.remove('show');
    showToast('Event refreshed');
    isRefreshing = false;
  }, 1500);
}

// Touch feedback simulation
function setupTouchFeedback() {
  // Add touch feedback to all interactive elements
  const interactiveElements = document.querySelectorAll('button, .attendee, .filter-chip');
  
  interactiveElements.forEach(element => {
    element.addEventListener('touchstart', () => {
      element.style.transform = 'scale(0.95)';
      element.style.transition = 'transform 0.1s ease';
    });
    
    element.addEventListener('touchend', () => {
      element.style.transform = 'scale(1)';
    });
    
    element.addEventListener('touchcancel', () => {
      element.style.transform = 'scale(1)';
    });
  });
}

// Simulate haptic feedback
function simulateHapticFeedback() {
  // For devices that support it
  if ('vibrate' in navigator) {
    navigator.vibrate(50);
  }
}

// Swipe gesture support (basic implementation)
function setupSwipeGestures() {
  let startX = 0;
  let startY = 0;
  
  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });
  
  document.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    
    const diffX = startX - endX;
    const diffY = startY - endY;
    
    // Horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe left - could navigate to next section
        console.log('Swiped left');
      } else {
        // Swipe right - could navigate to previous section
        console.log('Swiped right');
      }
    }
  });
}

// Initialize swipe gestures
setupSwipeGestures();

// Handle window resize for responsive behavior
window.addEventListener('resize', () => {
  // Adjust layout if needed
  if (window.innerWidth > 768) {
    // Tablet/desktop specific adjustments
    document.body.style.paddingBottom = '100px';
  } else {
    // Mobile specific adjustments
    document.body.style.paddingBottom = '100px';
  }
});

// Prevent zoom on double tap (mobile optimization)
let lastTouchEnd = 0;
document.addEventListener('touchend', function (event) {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Add CSS animation keyframes via JavaScript
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-10px);
    }
    60% {
      transform: translateY(-5px);
    }
  }
`;
document.head.appendChild(style);