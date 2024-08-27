import React, { useState } from 'react';
import axios from 'axios';
import { useCookies } from 'react-cookie';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [, setCookie] = useCookies(['token']);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('https://edc-central.xyz/v1/sessions', { email, password });
            setCookie('token', response.data.token, { path: '/' });
            window.location.href = '/map';
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    return (
        <div>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
                <label>
                    Email:
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <br />
                <label>
                    Password:
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>
                <br />
                <button type="submit">Login</button>
            </form>
        </div>
    );
};

export default LoginPage;
