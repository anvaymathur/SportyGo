# Badminton App

A comprehensive React Native application for managing badminton events, groups, and attendance tracking.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Components](#components)
- [Firebase Services](#firebase-services)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## 🎯 Overview

The Badminton App is a full-featured mobile application built with React Native and Firebase that enables users to:

- Create and manage badminton events
- Join groups and participate in group activities
- Vote on event attendance with real-time updates
- Track attendance during events
- Manage user profiles and preferences

## ✨ Features

### Core Functionality
- **Event Management**: Create, view, and manage badminton events
- **Voting System**: Real-time voting with live count updates
- **Group Management**: Create and join badminton groups
- **Attendance Tracking**: Mark and track event attendance
- **User Profiles**: Manage personal information and preferences

### Technical Features
- **Real-time Updates**: Live synchronization using Firebase listeners
- **Offline Support**: Robust error handling and data persistence
- **Type Safety**: Full TypeScript implementation
- **Responsive Design**: Optimized for various screen sizes
- **Performance Optimized**: Efficient data loading and caching

## 🏗️ Architecture

The application follows a modern React Native architecture with:

- **Frontend**: React Native with Expo Router
- **Backend**: Firebase Firestore
- **Authentication**: Auth0
- **UI Framework**: Tamagui for consistent theming
- **State Management**: React Hooks with Context API

### Project Structure
```
BadmintonApp/
├── app/                    # Main application components
│   ├── EventsList.tsx     # Event listing and management
│   ├── CreateGameSession.tsx # Event creation form
│   ├── EventView.tsx      # Event details and voting
│   ├── EventAttendance.tsx # Attendance tracking
│   └── components/        # Reusable UI components
├── firebase/              # Firebase configuration and services
│   ├── index.ts          # Firebase initialization
│   ├── types_index.ts    # TypeScript type definitions
│   └── services_firestore2.ts # Database operations
└── assets/               # Images, fonts, and static resources
```

## 🧩 Components

### EventsList Component
**File**: `app/EventsList.tsx`

A comprehensive event listing component that displays upcoming badminton events with voting functionality, search capabilities, and filtering options.

**Key Features:**
- Real-time event loading from user's groups and individual events
- Search functionality across event titles, groups, and locations
- Filtering by voting status (all, voting-open, voting-closed, my-events)
- Vote count display and user voting status
- Admin controls for event management
- Responsive design with floating action button

**Usage:**
```typescript
import EventsList from './app/EventsList';

// Component automatically handles:
// - Loading user's events
// - Real-time updates
// - Search and filtering
// - Navigation to event details
```

### CreateGameSession Component
**File**: `app/CreateGameSession.tsx`

A comprehensive form component for creating new badminton game sessions/events with voting, group selection, and participant management.

**Key Features:**
- Event creation with title, date, time, location, and cost
- Voting system configuration with cutoff dates
- Group and individual participant selection
- Form validation with real-time error feedback
- Success state with options to create another or view sessions
- Responsive design using Tamagui components

**Usage:**
```typescript
import CreateGameSession from './app/CreateGameSession';

// Form handles:
// - Data validation
// - Group/participant selection
// - Voting configuration
// - Event creation in Firestore
```

### EventView Component
**File**: `app/EventView.tsx`

A comprehensive event details and voting component that displays event information, allows users to vote, and provides admin controls.

**Key Features:**
- Detailed event information display (title, date, time, location, cost)
- Real-time voting system with live vote counts
- Countdown timer for voting cutoff
- Vote summary with filtering options
- Admin controls for event management
- Early event start functionality
- Attendance tracking integration

**Usage:**
```typescript
import EventView from './app/EventView';

// Component handles:
// - Event information display
// - Real-time voting
// - Admin controls
// - Navigation to attendance tracking
```

### EventAttendance Component
**File**: `app/EventAttendance.tsx`

A comprehensive attendance tracking component for badminton events that allows event creators (admins) to mark attendance for participants.

**Key Features:**
- Real-time attendance tracking with arrival timestamps
- Admin-only access control
- Attendance summary with statistics
- Visual indicators for arrival status
- Persistent attendance data storage
- User-friendly interface with clear status indicators

**Usage:**
```typescript
import EventAttendance from './app/EventAttendance';

// Component handles:
// - Admin access validation
// - Attendance marking
// - Statistics display
// - Data persistence
```

## 🔥 Firebase Services

### Configuration
**File**: `firebase/index.ts`

Main Firebase configuration file that initializes Firebase services including Firestore database and Analytics.

**Key Features:**
- Firebase app initialization
- Firestore database instance
- Analytics setup
- Project configuration management

### Type Definitions
**File**: `firebase/types_index.ts`

TypeScript type definitions for all Firebase data structures used throughout the application.

**Key Interfaces:**
- `UserDoc`: User profile data structure
- `GroupDoc`: Group information and settings
- `EventDoc`: Event details and configuration
- `VoteDoc`: Individual vote records
- `AttendanceRecord`: Attendance tracking data

### Database Services
**File**: `firebase/services_firestore2.ts`

Comprehensive Firebase Firestore service layer providing all database operations.

**Key Services:**

#### User Management
- `createUserProfile(uid, userDoc)`: Create new user profiles
- `getUserProfile(uid)`: Retrieve user information
- `updateUserProfile(uid, data)`: Update user data
- `getAllUserProfiles()`: Fetch all users
- `getEventUserProfiles(eventId)`: Get event participants

#### Group Management
- `createGroup(userId, group)`: Create new groups
- `getGroups()`: Retrieve all groups
- `getUserGroups(userId)`: Get user's groups

#### Event Management
- `createEvent(event)`: Create new events
- `getEvent(eventId)`: Retrieve event details
- `updateEvent(eventId, data)`: Update event information
- `listenGroupEvents(groupId, callback)`: Real-time group events
- `listenUserGroupEvents(groupIds, userId, callback)`: User's group events

#### Voting System
- `castVote(eventId, vote, userId)`: Submit user votes
- `getUserVote(eventId, userId)`: Get user's vote
- `getVoteCounts(eventId)`: Get vote statistics
- `listenVoteCounts(eventId, callback)`: Real-time vote updates

#### Attendance Tracking
- `updateAttendance(eventId, records)`: Save attendance data
- `getAttendanceRecords(eventId)`: Retrieve attendance records

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Firebase project
- Auth0 account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BadmintonApp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project
   - Enable Firestore database
   - Update `firebase/index.ts` with your configuration

4. **Configure Auth0**
   - Set up Auth0 application
   - Update authentication settings

5. **Start the development server**
   ```bash
   npx expo start
   ```

### Environment Setup

Create a `.env` file with your configuration:
```env
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
AUTH0_DOMAIN=your_auth0_domain
AUTH0_CLIENT_ID=your_client_id
```

## 📚 API Documentation

### Event Operations

#### Create Event
```typescript
const event: EventDoc = {
  id: '', // Auto-generated
  Title: 'Weekend Tournament',
  EventDate: new Date(),
  Location: 'Community Center',
  CreatorID: userId,
  VotingEnabled: true,
  CutoffDate: new Date(),
  GroupIDs: ['group1'],
  IndividualParticipantIDs: ['user1', 'user2']
};

await createEvent(event);
```

#### Vote on Event
```typescript
await castVote('eventId', 'going', 'userId');
```

#### Get Vote Counts
```typescript
const counts = await getVoteCounts('eventId');
// Returns: { going: 5, maybe: 2, not: 1 }
```

### User Operations

#### Create User Profile
```typescript
const user: UserDoc = {
  id: 'auth0|123456',
  Name: 'John Doe',
  Email: 'john@example.com',
  Groups: [],
  Phone: '+1234567890',
  Address: '123 Main St'
};

await createUserProfile('auth0|123456', user);
```

#### Get User Groups
```typescript
const groups = await getUserGroups('userId');
```

### Group Operations

#### Create Group
```typescript
const groupData = {
  Name: 'Weekend Warriors',
  Description: 'Casual weekend badminton group',
  SkillLevel: 'Intermediate',
  Privacy: 'Public',
  HomeCourt: 'Community Center',
  MeetingSchedule: 'Every Saturday 2-4 PM'
};

const groupId = await createGroup('userId', groupData);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add JSDoc comments for all functions
- Maintain consistent code formatting
- Write comprehensive tests
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Badminton App Team** - Building the future of badminton event management
