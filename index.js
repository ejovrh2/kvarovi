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
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <title>Login</title>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
      </head>
      <body class="bg-light">
        <div class="container d-flex align-items-center justify-content-center" style="min-height: 100vh;">
          <div class="card shadow-sm" style="width: 100%; max-width: 400px;">
            <div class="card-body">
              <h1 class="card-title text-center mb-4">Login</h1>
              <form method="post" action="/login">
                <div class="form-group">
                  <label for="email">Email</label>
                  <input type="email" class="form-control" id="email" name="email" value="hrvojelovrich@gmail.com" placeholder="Enter your email"  required>
                </div>
                <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" class="form-control" id="password" name="password" value="evalovric2023" placeholder="Enter your password" required>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Login</button>
              </form>
            </div>
          </div>
        </div>
        <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.2/dist/umd/popper.min.js"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
      </body>
      </html>
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
  const sqlQuery = req.query['sql-query']; 

  try {
    // Make multiple API calls with Authorization headers
    const [podaci, listaProjekata, listaFormi, currentUser] = await Promise.all([
      axios.get('https://edc-central.xyz/v1/projects/2/forms/CARLIT_v2.svc/Submissions?', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':'application/json'
        }
      }),
      axios.get('https://edc-central.xyz/v1/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':'application/json'
        }
      }),
      axios.get('https://edc-central.xyz/v1/projects/2/forms', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':'application/json'
        }
      }),
      axios.get('https://edc-central.xyz/v1/users/current', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':'application/json'
        }
      })     
    ]);

    

    const podaciForma=podaci.data
    const podaciJson=podaciForma.value

    const filteredJson = podaciJson.filter(item => item.__system.reviewState === 'approved');


    const geojson = {
      type: "FeatureCollection",
      features: filteredJson.map(item => {
          const { trace, __system, ...properties } = item;
  
          // Extract only the desired properties from __system
          const systemProperties = {
              submitterName: __system.submitterName,
              reviewState: __system.reviewState,
          };
  
          // Merge the system properties with the other properties
          const processedProperties = { ...properties, ...systemProperties };
  
          // Further process properties to handle arrays and objects
          for (const key in processedProperties) {
              if (processedProperties.hasOwnProperty(key)) {
                  const value = processedProperties[key];
                  if (Array.isArray(value)) {
                      processedProperties[key] = value.join(', ');
                  } else if (typeof value === 'object' && value !== null) {
                      processedProperties[key] = JSON.stringify(value);
                  }
              }
          }
  
          return {
              type: "Feature",
              geometry: {
                  type: trace.type,
                  coordinates: trace.coordinates.map(coord => [coord[0], coord[1]]) // Remove the altitude
              },
              properties: processedProperties
          };
      })
  };
  
  // Convert the GeoJSON object to a JSON string
  const geojsonString = JSON.stringify(geojson, null, 2);


  // Output the GeoJSON
  //console.log(geojsonString);
    

    const projekti = listaProjekata.data;
    let popisProjekta=  `
    <p class="text-primary font-weight-bold" style="font-size: 1.5rem; margin-bottom: 20px;">Popis projekata:</p>
    <div id="projectCarousel" class="carousel slide mt-3" data-ride="carousel">
        <ol class="carousel-indicators">
    `;
    
    // Add carousel indicators
    projekti.forEach((element, index) => {
        popisProjekta += `
            <li data-target="#projectCarousel" data-slide-to="${index}"${index === 0 ? ' class="active"' : ''}></li>
        `;
    });
    
    popisProjekta += `
        </ol>
        <div class="carousel-inner">
    `;
    
    // Add carousel items with random Picsum Photos images
    projekti.forEach((element, index) => {
        const imageUrl = `https://picsum.photos/800/400?random=${index}`; // Random image with size 800x400
        popisProjekta += `
            <div class="carousel-item${index === 0 ? ' active' : ''}">
                <img class="d-block w-100" src="${imageUrl}" alt="${element.name}">
                <div class="carousel-caption d-none d-md-block" style=" color: white; font-weight: bold; text-shadow: 1px 1px 2px black;font-family: cursive;">
                    <h5>${element.name}</h5>
                </div>
            </div>
        `;
    });
    
    popisProjekta += `
        </div>
        <a class="carousel-control-prev" href="#projectCarousel" role="button" data-slide="prev">
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="sr-only">Previous</span>
        </a>
        <a class="carousel-control-next" href="#projectCarousel" role="button" data-slide="next">
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="sr-only">Next</span>
        </a>
    </div>
    `;

    const forme = listaFormi.data;
    let popisForma= `
    <p class="text-primary font-weight-bold" style="font-size: 1.5rem; margin-bottom: 20px;">Popis formi:</p>
    <div id="formCarousel" class="carousel slide mt-3" data-ride="carousel">
        <ol class="carousel-indicators">
    `;
    
    // Add carousel indicators
    forme.forEach((element, index) => {
        popisForma += `
            <li data-target="#formCarousel" data-slide-to="${index}"${index === 0 ? ' class="active"' : ''}></li>
        `;
    });
    
    popisForma += `
        </ol>
        <div class="carousel-inner">
    `;
    
    // Add carousel items with random Picsum Photos images
    forme.forEach((element, index) => {
        const imageUrl = `https://picsum.photos/800/400?random=${index}`; // Random image with size 800x400
        popisForma += `
            <div class="carousel-item${index === 0 ? ' active' : ''}">
                <img class="d-block w-100" src="${imageUrl}" alt="${element.name}">
                <div class="carousel-caption d-none d-md-block" style=" color: white; font-weight: bold; text-shadow: 1px 1px 2px black;font-family: cursive;">
                    <h5>${element.name}</h5>
                </div>
            </div>
        `;
    });
    
    popisForma += `
        </div>
        <a class="carousel-control-prev" href="#formCarousel" role="button" data-slide="prev">
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="sr-only">Previous</span>
        </a>
        <a class="carousel-control-next" href="#formCarousel" role="button" data-slide="next">
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="sr-only">Next</span>
        </a>
    </div>
    `;


    const user=currentUser.data
    let displayName = `<p>${user.displayName}</p>`;

    

   // Generate the content for the Info pane of the sidebar
   

     // Output the JSON data to the console


  // Display random map using Leaflet.js
  // Here, you would implement the logic to generate and send the map HTML
  const mapHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <title>Leaflet Map with Sidebar</title>
  
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <meta charset="utf-8">
  
      <!-- Leaflet CSS and JS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
<link
  rel="stylesheet"
  href="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.css"
/>

    <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>

  
      <!-- Leaflet Sidebar V2 CSS and JS -->
      <link rel="stylesheet" href="https://unpkg.com/leaflet-sidebar-v2@3.1.1/css/leaflet-sidebar.min.css">
      <script src="https://unpkg.com/leaflet-sidebar-v2@3.1.1/js/leaflet-sidebar.min.js"></script>
  
      <!-- Bootstrap CSS -->
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" integrity="sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO" crossorigin="anonymous">
  
      <!-- jQuery, Popper.js, and Bootstrap JS -->
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js" integrity="sha512-894YE6QWD5I59HgZOGReFYm4dnWc1Qt5NtvYSaNcOP+u1T9qYdvdihz0PPSiiqn/+/3e7Jo4EaG7TubfWGUrMQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
      <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js" integrity="sha384-ChfqqxuZUCnJSK3+MXmPNIyE6ZbWh2IMqE241rYiqJxyMiZ6OW/JmZQ5stwEULTy" crossorigin="anonymous"></script>
  
      <!-- Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" integrity="sha512-Kc323vGBEqzTmouAECnVceyQqyqdsSiqLQISBL29aUW4U/M7pSPA/gEUZQqv1cwx4OnYxTxve5UMg5GT6L4JJg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-providers/1.13.0/leaflet-providers.js" integrity="sha512-pb9UiEEi2JIxkMloqYnqgONe9CTcp2BWWq1Hbz60l7f3R3VhZ57dEE58Ritf/HgBw3o/5Scf5gg0T9V+tf48fg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>


<!-- Include Leaflet Browser Print CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet.browser.print/dist/leaflet.browser.print.min.css" />

<!-- Include Leaflet Browser Print JS -->
<script src="https://unpkg.com/leaflet.browser.print/dist/leaflet.browser.print.min.js"></script>


<script src="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.js"></script>

      <style>
          body {
              padding: 0;
              margin: 0;
          }
  
          html, body, #map {
              height: 100%;
              font: 10pt "Helvetica Neue", Arial, Helvetica, sans-serif;
          }
              #sidebar{
              opacity:0.8;
              }
  
          .lorem {
              font-style: italic;
              color: #AAA;
          }
                     #sidebar {
            position: absolute;
            top: 10px;
            left: 10px;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
        }
     .filter-box {
        margin-bottom: 1rem;
    }
    .filter-box h4 {
        margin-bottom: 0.5rem;
    }
    .btn-group {
        display: flex;
        flex-wrap: wrap;
    }
    .btn-group .btn {
        flex: 1 1 30%; /* Adjust percentage to fit 3 buttons per row */
        margin: 0.5rem;
    }


      </style>
  </head>
  <body>
      <div id="map"></div>
      <div id="sidebar" class="leaflet-sidebar collapsed">
          <div class="leaflet-sidebar-tabs">
              <ul role="tablist">
                  <li><a href="#home" role="tab"><i class="fa fa-home"></i></a></li>
                  <li><a href="#filter" role="tab"><i class="fa-solid fa-filter"></i></a></li>
                  <li><a id="downloadBtn" href="#download" role="tab"><i class="fa-solid fa-download"></i></a></li>
                   <li><a href="#info" role="tab"><i class="fa fa-info"></i></a></li>
                    <li><a href="#setup" role="tab"><i class="fa fa-cog"></i></a></li>


                    <li><a href="/logout" role="tab"><i class="fa fa-sign-out-alt"></i> Logout</a></li>
              </ul>
          </div>
          <div class="leaflet-sidebar-content">
              <div class="leaflet-sidebar-pane" id="home">
                  <h1 class="leaflet-sidebar-header"> ${displayName}</h1>
                  <h4>Poštovani, ovdje su dostupni svi podaci koji su odobreni (eng.approved) unutar ODK Central servera na kojem se prikupljaju podaci iz pripremljenih formi.</h4>
             <h4>Koristite isti username i password za editiranje podataka direktno na Central serveru dosupnom na adresi <a href="https://edc-central.xyz/" target="_blank">EDC central server</a> </h4>
                  </div>
               <div class="leaflet-sidebar-pane sidebar" id="filter">
                  <h1 class="leaflet-sidebar-header">Fitriraj podatke na karti</h1>

              </div>

               <div class="leaflet-sidebar-pane" id="download">
                  <h1 class="leaflet-sidebar-header"> ${displayName}</h1>
                  <h4 class="lorem">Preuzmi podatke</h4>
                  <p>Podaci se preuzimaju u popularnom geojson formatu. Ukoliko se odabarli neke filtere, preuzeti file će sadržavati samo filtrirane podatke.</p>
              </div>

              <div class="leaflet-sidebar-pane" id="info">
              <h1 class="leaflet-sidebar-header">Lista projekta i formi</h1>

              
              
                    ${popisProjekta} 
                    ${popisForma} 
                  
              </div>

        <div class="leaflet-sidebar-pane" id="setup">
            <h1 class="leaflet-sidebar-header">Setup</h1>
            <div class="form-group">
                <label class="form-label" for="toggleZoom">Kontrole zoom na karti</label>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggleZoom" checked>
                    <label class="form-check-label" for="toggleZoom">Omogući tipke</label>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="toggleZoom">Grafičko mjerilo na karti</label>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggleScale" >
                    <label class="form-check-label" for="toggleScale">Omogući mjerilo</label>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="toggleZoom">Crtanje na karti</label>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggleDraw" >
                    <label class="form-check-label" for="toggleDraw">Omogući crtanje na karti</label>
                </div>
            </div>
        </div>



        </div>
      </div>
      <script>


             let geojsonLayer;
        let originalFeatures = [];
        let filteredFeatures = [];
        let activeFilters = {};

        const map = L.map('map',{ zoomControl: false,tap:false }).setView([45.0, 15.0], 8);

            


             var lyrDOF = new L.TileLayer.WMS('https://geoportal.dgu.hr/services/dof/wms', {
      layers: 'DOF5_2011',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      attribution: '© <a href="https://dgu.gov.hr/" target="_blank">Državna geodetska uprava</a>'
      //crs: crs,
      //crs: L.CRS.EPSG3765
    });
        lyrOSM = L.tileLayer.provider('OpenStreetMap.Mapnik').addTo(map);


                  objBasemaps = {
            "DOF": lyrDOF,
            "OSM": lyrOSM,

        };

                objOverlays = {
         
        };

        ctlLayers = L.control.layers(objBasemaps, objOverlays).addTo(map);





        let zoomControl;

    // Initial state: No zoom controls (as per your requirement)
    const zoomControlToggle = document.getElementById('toggleZoom');
    zoomControlToggle.checked = false;

    // Function to add or remove zoom controls
    function updateZoomControls() {
        if (zoomControlToggle.checked) {
            if (!zoomControl) {
                zoomControl = new L.Control.Zoom({ position: 'topright' });
                zoomControl.addTo(map);
            }
        } else {
            if (zoomControl) {
                map.removeControl(zoomControl);
                zoomControl = null;
            }
        }
    }

    // Listen for the toggle change event
    zoomControlToggle.addEventListener('change', updateZoomControls);

    let scaleControl;

    const scaleControlToggle = document.getElementById('toggleScale');
    scaleControlToggle.checked = false;

    function updateScaleControls() {
        if (scaleControlToggle.checked) {
            if (!scaleControl) {
                scaleControl = new L.control.scale({position: 'bottomright'});
                scaleControl.addTo(map);
            }
        } else {
            if (scaleControl) {
                map.removeControl(scaleControl);
                scaleControl = null;
            }
        }
    }

    // Listen for the toggle change event
    scaleControlToggle.addEventListener('change', updateScaleControls);


     let drawControl;

    const drawControlToggle = document.getElementById('toggleDraw');
    drawControlToggle.checked = false;

    function updatedrawControls() {
        if (drawControlToggle.checked) {
            if (!drawControl) {
          var options = {
  position: 'topright', // toolbar position, options are 'topleft', 'topright', 'bottomleft', 'bottomright'
  drawMarker: true,  // adds button to draw markers
  drawPolygon: true,  // adds button to draw a polygon
  drawPolyline: true,  // adds button to draw a polyline
  drawCircle: true,  // adds button to draw a cricle
  drawCircleMarker: true,  // adds button to draw a cricleMarker
  drawRectangle: true,  // adds button to draw a rectangle
  cutPolygon: true,   // adds a button to cut layers
  dragMode: true,  // adds button to toggle global move mode
  deleteLayer: true,   // adds a button to delete layers
  editMode: true,  // adds button to toggle global edit mode
};

// add leaflet.pm controls to the map
map.pm.addControls(options);
            }
        } else {
           
               map.pm.removeControls();
               
               
            
        }
    }

    // Listen for the toggle change event
    drawControlToggle.addEventListener('change', updatedrawControls);

        function addGeoJSONLayer(data) {
            originalFeatures = data.features;
            filteredFeatures = [...originalFeatures];
            geojsonLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
                style: function (feature) {
                    return { color: 'blue' };
                },
                onEachFeature: function (feature, layer) {
                    layer.on('click', function () {
                        var properties = feature.properties;
                        var popupContent = "<ul>";
                        for (var key in properties) {
                            if (properties.hasOwnProperty(key)) {
                                popupContent += "<li><strong>" + key + ":</strong> " + properties[key] + "</li>";
                            }
                        }
                        popupContent += "</ul>";
                        layer.bindPopup(popupContent).openPopup();
                    });
                }
            }).addTo(map);


        // Example event listener
        map.on('pm:create', (e) => {
            console.log('Feature created:', e);
        });

        map.on('pm:remove', (e) => {
            console.log('Feature removed:', e);
        });

        map.on('pm:edit', (e) => {
            console.log('Feature edited:', e);
        });
      

        const sidebar = L.control.sidebar('sidebar', {
            position: 'left',
             closeButton: true, 
        }).addTo(map);

            ctlLayers.addOverlay(geojsonLayer, "CARLIT_V2");

                 if (filteredFeatures.length > 0) {
        const bounds = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }).getBounds();
        map.fitBounds(bounds);

    }

            initializeFilters();
        }

        // Create a custom control for attribution
L.Control.CustomAttribution = L.Control.extend({
    options: {
        position: 'bottomright',
        attribution: ''
    },
    onAdd: function (map) {
        var container = L.DomUtil.create('div', 'leaflet-control-attribution');
        container.innerHTML = this.options.attribution;
        return container;
    }
});

// Create and add the attribution control
const customAttributionControl = new L.Control.CustomAttribution({
    attribution: 'Layer Carlit_v2 provided by <a href="https://edc-central.xyz" target="_blank">ODK Central</a>'
});
customAttributionControl.addTo(map);

       function createFilterBoxes(attributes) {
    const filterDiv = document.getElementById('filter');
    filterDiv.innerHTML = '<h1 class="leaflet-sidebar-header">Filtriraj CARLIT_v2</h1>';

    attributes.forEach(attribute => {
        const uniqueValues = [...new Set(filteredFeatures.flatMap(feature => feature.properties[attribute] ?? 'null'))];
        
        const boxDiv = document.createElement('div');
        boxDiv.className = 'filter-box mb-3';
       boxDiv.style.margin = '5px';

        const heading = document.createElement('h4');
        heading.textContent = attribute;
        heading.style.color = 'white'; // Set text color to white
        heading.style.backgroundColor = '#0074d9'; // Set background color to yellow
        heading.style.textAlign = 'center'; // Center text
        heading.style.borderRadius = '0.5cm'; // Set border radius to 0.5cm
        boxDiv.appendChild(heading);

        const buttonGroup = document.createElement('div');
         
        buttonGroup.className = 'btn-group';

        uniqueValues.forEach(value => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-primary';
            button.textContent = value === 'null' ? 'null' : value;
              button.style.borderRadius = '0.5cm'; 
            button.dataset.attribute = attribute;
            button.dataset.value = value;

            // Check if the button should be active
            if (activeFilters[attribute] === value) {
                button.classList.remove('btn-outline-primary');
                button.classList.add('btn-success');
            }

            button.addEventListener('click', () => handleButtonClick(attribute, value, button));
            buttonGroup.appendChild(button);
        });

        boxDiv.appendChild(buttonGroup);
        filterDiv.appendChild(boxDiv);
    });
}

function handleButtonClick(attribute, value, clickedButton) {
    // Toggle button class based on its current state
    if (clickedButton.classList.contains('btn-success')) {
        clickedButton.classList.remove('btn-success');
        clickedButton.classList.add('btn-outline-primary');
        delete activeFilters[attribute];
    } else {
        clickedButton.classList.remove('btn-outline-primary');
        clickedButton.classList.add('btn-success');
        activeFilters[attribute] = value;
    }

    // Apply the filters and update the filter buttons
    applyFilters();
}

      function applyFilters() {


       ctlLayers.removeLayer(geojsonLayer);
        map.removeLayer(geojsonLayer)

    // Filter the features based on active filters
    filteredFeatures = originalFeatures.filter(feature => {
        for (const [attribute, value] of Object.entries(activeFilters)) {
            const featureValue = feature.properties[attribute];
            if (!(featureValue === value || (value === 'null' && featureValue == null))) {
                return false;
            }
        }
        return true;
    });

    // Update the GeoJSON layer with filtered features
    geojsonLayer.clearLayers();

    geojsonLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
        style: function (feature) {
            return { color: 'blue' };
        },
        onEachFeature: function (feature, layer) {
            layer.on('click', function () {
                var properties = feature.properties;
                var popupContent = "<ul>";
                for (var key in properties) {
                    if (properties.hasOwnProperty(key)) {
                        popupContent += "<li><strong>" + key + ":</strong> " + properties[key] + "</li>";
                    }
                }
                popupContent += "</ul>";
                layer.bindPopup(popupContent).openPopup();
            });
        }
    }).addTo(map);

     ctlLayers.addOverlay(geojsonLayer, "CARLIT_V2");

      if (filteredFeatures.length > 0) {
        const bounds = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }).getBounds();
        map.fitBounds(bounds);
    }

    // Update the filter buttons based on filtered features
    updateFilterButtons();
}

       function updateFilterButtons() {
    // Extract attributes from filtered features
    const excludeAttributes = ['start', 'end', 'username', 'biljeska', 'meta', '__id'];
    const attributes = [...new Set(filteredFeatures.flatMap(feature => Object.keys(feature.properties)))]
        .filter(attr => !excludeAttributes.includes(attr));

    // Create filter boxes for the current attributes
    createFilterBoxes(attributes);
}

        function initializeFilters() {
            const excludeAttributes = ['start', 'end', 'username', 'biljeska', 'meta', '__id'];
            const attributes = [...new Set(originalFeatures.flatMap(feature => Object.keys(feature.properties)))]
                .filter(attr => !excludeAttributes.includes(attr));

            createFilterBoxes(attributes);
        }

        const geojsonData = {
            "type": "FeatureCollection",
            "features": [
                // Add your GeoJSON features here
            ]
        };

        addGeoJSONLayer(${geojsonString});

document.getElementById('downloadBtn').addEventListener('click', () => {
    // Convert filtered GeoJSON data to a Blob and trigger download
   //sidebar.close();
    downloadFilteredData();
});

function downloadFilteredData() {
    // Get the current GeoJSON data from the map
    const filteredGeoJSON = getFilteredGeoJSON();
    
    // Convert GeoJSON data to a JSON string
    const dataStr = JSON.stringify(filteredGeoJSON, null, 2);
    
    // Create a Blob from the JSON string
    const blob = new Blob([dataStr], { type: 'application/json' });
    
    // Create a link element
    const link = document.createElement('a');
    
    // Set the download attribute with a filename
    link.href = URL.createObjectURL(blob);
    link.download = 'filtered_data.geojson';
    
    // Append the link to the document
    document.body.appendChild(link);
    
    // Programmatically click the link to trigger the download
    link.click();
    
    // Remove the link from the document
    document.body.removeChild(link);
}

function getFilteredGeoJSON() {
    // Retrieve the filtered features from the map
    const filteredFeatures = geojsonLayer.getLayers().map(layer => layer.feature);
    
    // Create a GeoJSON object
    return {
        type: 'FeatureCollection',
        features: filteredFeatures
    };
}


 
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
