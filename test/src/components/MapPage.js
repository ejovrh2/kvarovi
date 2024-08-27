import React, { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-sidebar-v2/css/leaflet-sidebar.css';  // Adjust path if necessary
import Sidebar from 'leaflet-sidebar-v2';
import axios from 'axios';
import { useCookies } from 'react-cookie';

const MapPage = () => {
    const [projects, setProjects] = useState([]);
    const [cookies, , removeCookie] = useCookies(['token']);
    const token = cookies.token;

    useEffect(() => {
        // Fetch projects
        const fetchProjects = async () => {
            try {
                const response = await axios.get('https://edc-central.xyz/v1/projects', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setProjects(response.data);
            } catch (error) {
                console.error('Error fetching projects', error);
            }
        };

        fetchProjects();
    }, [token]);

    useEffect(() => {
        // Initialize the map
        const map = L.map('map').setView([51.505, -0.09], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Initialize sidebar
        const sidebar = new Sidebar({
            container: 'sidebar',
            position: 'left'
        }).addTo(map);

        // Populate sidebar with project data
        const sidebarContent = document.getElementById('sidebar-content');
        sidebarContent.innerHTML = `
            <h2>Projects</h2>
            <ul>
                ${projects.map(project => `<li>${project.name}</li>`).join('')}
            </ul>
        `;
    }, [projects]);

    const handleLogout = () => {
        removeCookie('token');
        window.location.href = '/';
    };

    return (
        <div>
            <button onClick={handleLogout}>Logout</button>
            <div id="map" style={{ height: '100vh', width: '75%', float: 'left' }}></div>
            <div id="sidebar" className="leaflet-sidebar" style={{ height: '100vh', width: '25%', float: 'right', background: '#f9f9f9', borderLeft: '2px solid #ddd' }}>
                <div id="sidebar-content"></div>
            </div>
        </div>
    );
};

export default MapPage;
