require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Import cookie-parser



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
  res.send(`
    <h1>Login</h1>
    <form method="post" action="/login">
      <input type="email" name="email" placeholder="email" required><br>
      <input type="password" name="password" placeholder="Password" required><br>
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
  const mapHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Leaflet Map with Bootstrap Table</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <style>
    body, html {
      
      height: 100%;
      width: 100%;
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    #map {
      flex: 1;
    }
    #table-container {
      height: 300px; /* Set a fixed height for the table container */
      overflow-y: auto; /* Enable vertical scrolling */

    }
  </style>
  </head>
  <body>
  <div class="container">
  <div id="map"></div>
  <div id="table-container" class="container mt-4">
      <h2>Prijavljeni kvarovi</h2>
      <table id="mytable" class="table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Tip kvara</th>
            <th>Lokacija</th>
            <th>Lokacija2</th>
            <th>Napomena</th>
            <th>Korisnik</th>
            <th>Odobreno</th>
            <!-- Add more table headers as needed -->
          </tr>
        </thead>
        <tbody>
          ${data.map(submission => `
            <tr>
              <td>${submission.today}</td>
              <td>${submission.kvar}</td>
              <td>${submission.store_gps.coordinates[0]}</td>
              <td>${submission.store_gps.coordinates[1]}</td>
              <td>${submission.napomena}</td>
              <td>${submission.__system.submitterName}</td>
              <td>${submission.__system.reviewState}</td>
              <!-- Add more table cells as needed -->
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    </div>
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <script>
    var map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    var markers = [];
    var bounds = new L.LatLngBounds();

    // Add markers for each submission
    ${data.map(submission => {
      const lng = parseFloat(submission.store_gps.coordinates[0]);
      const lat = parseFloat(submission.store_gps.coordinates[1]);
      const __id=submission.__id
      const img1=submission.img1
      console.log(__id)
      const url='https://edc-central.xyz/v1/projects/1/forms/kvarovi/submissions/'+__id+'/attachments/'+img1
      return `
        var marker = L.marker([${lat}, ${lng}]).addTo(map);
        marker.bindPopup('<b>${submission.today}</b><br>${submission.kvar}<br>${submission.napomena}<br><a href="${url}"target="_blank">Fotografija</a>');
        markers.push(marker);
        bounds.extend(marker.getLatLng());
      `;
    }).join('')}

    // Zoom the map to fit all markers
    map.fitBounds(bounds);

    const rows = document.querySelectorAll('#mytable tbody tr');

    // Add click event listener to each row
    rows.forEach(row => {
      row.addEventListener('click', () => {
        // Read values from the clicked row
        console.log(row.cells[0])
        //const id = row.cells[0].innerText;
        const lat = row.cells[2].innerText;
    const lng = row.cells[3].innerText;
    map.setView([lng, lat],18);
      })
    })
    </script>

   
  </body>
  </html>
`;

res.send(mapHtml);
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
