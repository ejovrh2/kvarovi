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
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser()); // Use cookie-parser middleware


// In-memory store for logged-in users (for demonstration purposes)
const loggedInUsers = new Set();

// Login form route
app.get('/', (req, res) => {
  res.send(`
    <h1>Login</h1>
    <form method="post" action="/login">
      <input type="email" name="email" placeholder="email" value="hrvojelovrich@gmail.com" required><br>
      <input type="password" name="password" placeholder="Password" value="evalovric2023" required><br>
      <button type="submit">Login</button>
    </form>
  `);
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
      res.redirect('/maps');
      
    } else {
      res.redirect('/');
    }
  } catch (error) {
    // If there's an error or login fails
    console.error(error);
    res.redirect('/');
  }
});

// Route to display maps (requires user to be logged in)
app.get('/maps', async (req, res) => {
  const token = req.cookies.token;


  try {
    // Fetch data from the provided URL using the token
    const response = await axios.get('https://edc-central.xyz/v1/projects/1/forms/kvarovi.svc/Submissions', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    

    // Extract the data from the response
    const data = response.data.value;
    //console.log(data)


  // Display random map using Leaflet.js
  // Here, you would implement the logic to generate and send the map HTML
  

  res.sendFile(path.join(__dirname, 'public', 'karta.html'));
} catch (error) {
  console.error(error);
  //res.send('<h1>Error fetching data.</h1>');
  res.redirect('/')
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
