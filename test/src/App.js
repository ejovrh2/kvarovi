import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import MapPage from './components/MapPage';

const App = () => (
    <Router>
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/map" element={<MapPage />} />
        </Routes>
    </Router>
);

export default App;
