require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Import cookie-parser
const path = require('path');



const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to enable CORS
app.use(cors());

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser()); // Use cookie-parser middleware


// In-memory store for logged-in users (for demonstration purposes)
const loggedInUsers = new Set();

// Login form route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Make a request to the login endpoint
    const response = await axios.post('https://edc-central.xyz/v1/sessions', {
      email,
      password
    });

    // If login is successful, save token and mark user as logged in
    if (response.status === 200) {
      const token = response.data.token;
      loggedInUsers.add(token);
      res.cookie('token', token); // Set token as cookie
      res.sendFile(path.join(__dirname, 'public', 'karta.html'));
      
    } else {
      res.redirect('/');
    }
  } catch (error) {
    // If there's an error or login fails
    console.error(error);
    res.redirect('/');
  }
});


// Route to log out (clears token)
app.get('/logout', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    loggedInUsers.delete(token);
    res.clearCookie('token');
  }
  res.redirect('/');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
