import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import TouristList from './components/TouristList';
import Registration from './components/Registration';
import Dashboard from './components/Dashboard';
import PanicAlerts from './components/PanicAlerts';
import MissingComplaints from './components/MissingComplaints';
import { DataProvider } from './contexts/DataContext';
import './App.css';

function App() {
    return (
        <DataProvider>
            <Router>
                <div className="app-container">
                    <Navigation />

                    
                    <Routes>
                        <Route path="/" element={<TouristList />} />
                        <Route path="/register" element={<Registration />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/panic-alerts" element={<PanicAlerts />} />
                        <Route path="/missing-complaints" element={<MissingComplaints />} />
                    </Routes>
                </div>
            </Router>
        </DataProvider>
    );
}

export default App;
