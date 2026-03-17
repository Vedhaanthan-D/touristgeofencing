# Tourist Geo-Fencing - Registration System

This repository contains the backend and frontend for the Tourist Registration System with Blockchain integration support.

## 📁 Project Structure

```
├── backend/          # Node.js Express backend with Firebase
├── frontend/         # React frontend for tourist registration
└── blockchain/       # Smart contracts (optional - for future deployment)
```

## 🚀 Features

- **Tourist Registration**: Register tourists with personal and trip details
- **Firebase Integration**: Authentication and Firestore database
- **Safety Monitoring**: Panic alerts and missing complaints tracking

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account and project

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with your Firebase credentials:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
```

4. Start the backend:
```bash
npm start
# or on Windows
start.bat
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
VITE_API_URL=http://localhost:3000
```

4. Start the development server:
```bash
npm run dev
```

## 📱 Flutter App Integration

The Flutter app ([tourist_geo_fencing](../tourist_geo_fencing)) connects to this backend for:
- User authentication (email + DTID)
- Tourist status verification
- Safety alert management

## 🔐 Security Notes

- **Never commit `.env` files** - they contain sensitive Firebase credentials
- The `.env` file is gitignored by default
- Create `.env.example` files as templates without actual credentials

## 🌐 API Endpoints

### Backend API (Port 3000)
- `POST /api/register` - Register new tourist
- `POST /api/is-active` - Check tourist active status
- `GET /api/tourists` - List all tourists
- `GET /api/tourists/:dtid` - Get tourist by DTID
- `GET /api/panic-alerts` - Get panic alert emergencies
- `GET /api/safety-alerts` - Get safety alerts

## 📦 Deployment

The system is designed to work **without blockchain deployment** for simpler setup:
- Backend uses Firebase for data storage
- DTID generation via UUID (not blockchain)
- All authentication through Firebase Auth

For blockchain features (optional):
- Deploy smart contracts in the `blockchain` folder
- Uncomment blockchain endpoints in backend
- Update environment variables with contract addresses

## 📄 License

This is a SIH (Smart India Hackathon) project.

## 🤝 Contributing

This is a hackathon project. For the main tourist geo-fencing Flutter app, see the parent directory.
