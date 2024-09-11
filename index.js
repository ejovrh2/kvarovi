require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Import cookie-parser
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to enable CORS
app.use(cors());
const dataDir = path.join(__dirname, 'data');
app.use(express.static(dataDir));

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
                  <input type="email" class="form-control" id="email" name="email"   placeholder="Enter your email"  required>
                </div>
                <div class="form-group">
                  <label for="password">Password</label>
                  <input type="password" class="form-control" id="password" name="password"  placeholder="Enter your password" required>
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

app.get('/data', (req, res) => {
    const geojsonFiles = [];

    // Recursively read folders and files
    function readDirRecursive(dir) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                readDirRecursive(fullPath);
            } else if (path.extname(fullPath) === '.geojson') {
                // Save relative path to the file
                geojsonFiles.push(path.relative(dataDir, fullPath));
            }
        });
    }

    readDirRecursive(dataDir);

    res.json(geojsonFiles);
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
    
    projekti.forEach((element, index) => {
        const imageUrl = `https://picsum.photos/800/400?random=${index}`; // Random image with size 800x400
        popisProjekta += `
            <div class="carousel-item${index === 0 ? ' active' : ''}">
                <img class="d-block w-100" src="${imageUrl}" alt="${element.name}">
               <div class="carousel-caption" style="color: white; font-weight: bold; text-shadow: 1px 1px 2px black; font-family: cursive;">
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
<div class="row">
`;
    
forme.forEach((element, index) => {
    const imageUrl = `https://picsum.photos/140/140?random=${index}`; // Random image with size 140x140
    popisForma += `
        <div class="col-lg-4 text-center mb-4">
            <img src="${imageUrl}" class="bd-placeholder-img rounded-circle" width="140" height="140" alt="${element.name}">
            <h2 class="text-secondary font-weight-bold" style="font-size: 1.5rem; margin-bottom: 15px;">${element.name}</h2>
            <p>Projekt ${element.name} osmišljen je za prikupljanje obalnih podataka.</p>
            <p><a class="btn btn-light" href="#">Pogledaj detalje »</a></p>
        </div>
    `;
});

popisForma += `</div>`;



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
      <title>IRB-CIM</title>
  
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <meta charset="utf-8">
  
      <!-- Leaflet CSS and JS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
 <script src="https://unpkg.com/leaflet@1.6.0/dist/leaflet.js" crossorigin=""></script>



<link
  rel="stylesheet"
  href="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.css"
/>

    <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>

  
      <!-- Leaflet Sidebar V2 CSS and JS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet-sidebar-v2/css/leaflet-sidebar.min.css" />
<script src="https://unpkg.com/leaflet-sidebar-v2/js/leaflet-sidebar.min.js"></script>

  
      <!-- Bootstrap CSS -->
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" integrity="sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO" crossorigin="anonymous">
  
      <!-- jQuery, Popper.js, and Bootstrap JS -->
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js" integrity="sha512-894YE6QWD5I59HgZOGReFYm4dnWc1Qt5NtvYSaNcOP+u1T9qYdvdihz0PPSiiqn/+/3e7Jo4EaG7TubfWGUrMQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.3/umd/popper.min.js" integrity="sha384-ZMP7rVo3mIykV+2+9J3UJ46jBk0WLaUAdn689aCwoqbBJiSnjAK/l8WvCWPIPm49" crossorigin="anonymous"></script>
      <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.min.js" integrity="sha384-ChfqqxuZUCnJSK3+MXmPNIyE6ZbWh2IMqE241rYiqJxyMiZ6OW/JmZQ5stwEULTy" crossorigin="anonymous"></script>
  
      <!-- Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" integrity="sha512-Kc323vGBEqzTmouAECnVceyQqyqdsSiqLQISBL29aUW4U/M7pSPA/gEUZQqv1cwx4OnYxTxve5UMg5GT6L4JJg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-providers/1.13.0/leaflet-providers.js" integrity="sha512-pb9UiEEi2JIxkMloqYnqgONe9CTcp2BWWq1Hbz60l7f3R3VhZ57dEE58Ritf/HgBw3o/5Scf5gg0T9V+tf48fg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>



<script src="https://unpkg.com/@geoman-io/leaflet-geoman-free@latest/dist/leaflet-geoman.js"></script>


    <!-- Leaflet.markercluster CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css" />

<!-- Leaflet.markercluster JavaScript -->
<script src="https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js"></script>

<link rel="stylesheet" href="https://unpkg.com/leaflet.browser.print/dist/leaflet.browser.print.min.css" />
<script src="https://unpkg.com/leaflet.browser.print/dist/leaflet.browser.print.min.js"></script>

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

                  /* Ensure the sidebar content area scrolls if it's too tall */
    .leaflet-sidebar-content {
        height: 100%;
        overflow-y: auto;
    }

    /* Make sure the sidebar header and other content styles fit well */
    .leaflet-sidebar-pane {
        padding: 15px; /* Adjust padding as needed */
        box-sizing: border-box; /* Include padding in the element's total width and height */
    }

    /* For better mobile experience, you might want to set a max-height */
    @media (max-width: 767px) {
        .leaflet-sidebar-content {
            max-height: 100vh; /* Ensure it does not exceed the viewport height */
        }
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
.drop-area {
    border: 2px dashed #ccc;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    margin-top: 20px;
    cursor: pointer;
}

.drop-area.hover {
    border-color: #333;
}

#fileSelect {
    margin-top: 10px;
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
                    <li><a href="#upload" role="tab"><i class="fa fa-upload"></i></a></li>
                    <li class="disabled"><a href="#database"  id="btnDatabase" role="tab">
        <span class="fa-stack">
            <i class="fa-solid fa-circle fa-stack-2x"></i> <!-- Background circle -->
            <strong id="clusterCount" class="fa-stack-1x fa-inverse"></strong> <!-- Number in the center -->
        </span>
</a></li>
 <li><a id="print" href="#print" role="tab"><i class="fa-regular fa-map"></i></a></li>
<li><a id="gps" href="#gps" role="tab"><i class="fa-regular fa-compass"></i></a>
</li>


            <li><a href="/logout" role="tab"><i class="fa fa-sign-out-alt"></i> Logout</a></li>
              </ul>
          </div>
          <div class="leaflet-sidebar-content">
              <div class="leaflet-sidebar-pane" id="home">
            <h1 class="leaflet-sidebar-header" style="font-family: 'Arial', sans-serif; font-size: 12px; line-height: 1.6; color: white;">Korisnik: ${displayName}</h1>
    <h4 style="font-family: 'Arial', sans-serif; font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 15px;">
        Poštovani, ovdje su dostupni svi podaci koji su odobreni (eng. approved) unutar ODK Central servera na kojem se prikupljaju podaci iz pripremljenih formi.
    </h4>
    <h4 style="font-family: 'Arial', sans-serif; font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 15px;">
        Koristite isti username i password za editiranje podataka direktno na Central serveru dosupnom na adresi 
        <a href="https://edc-central.xyz/" target="_blank" style="color: #007bff; text-decoration: none;">EDC central server</a>.
    </h4>
    <h4 style="font-family: 'Arial', sans-serif; font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 15px;">
        Uz podatke prikupljenih preko forme, dostupni su i povijesni podaci koji se mogu preuzeti tako da se klikne na klaster/skup podataka. 
    </h4>
     <img src="download.gif" alt="Example GIF" 
         style="width: 100%; max-width: 300px; margin-top: 20px; display: block; border-radius: 10px;">
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

<div class="leaflet-sidebar-pane" id="upload"> <!-- New upload section -->
    <h1 class="leaflet-sidebar-header">Upload GeoJSON</h1>
    <div id="drop-area" class="drop-area border border-primary rounded p-3 text-center" style="height: 200px;">
        <h3>Drag & Drop GeoJSON file here</h3>
        <input type="file" id="fileElem" accept=".geojson, .json" style="display:none;">
        <button id="fileSelect" class="btn btn-primary">Select GeoJSON File</button>
    </div>
    <p id="upload-status" class="mt-3"></p>
</div>

              <div class="leaflet-sidebar-pane sidebar" id="database">
                  <h1 class="leaflet-sidebar-header">Pregled povijesnih podataka</h1>
                  <p id="infoTextFilter">Odaberi sloj koji želiš filtrirati</p>
      <div id="layerListContainer">
            
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
    layerName:'DOF2011',
      transparent: true,
      version: '1.3.0',
      attribution: '© <a href="https://dgu.gov.hr/" target="_blank">Državna geodetska uprava</a>'
      //crs: crs,
      //crs: L.CRS.EPSG3765
    });
        lyrOSM = L.tileLayer.provider('OpenStreetMap.Mapnik',{
        layerName:'OSM'}).addTo(map);


                  objBasemaps = {
            "DOF": lyrDOF,
            "OSM": lyrOSM,

        };

                objOverlays = {
         
        };



        ctlLayers = L.control.layers(objBasemaps, objOverlays).addTo(map);

       var sidebar = L.control.sidebar( {
         container: 'sidebar',
            position: 'left',
             autopan:true
        }).addTo(map);

        var obalna_linija
         fetch('obalna_linija_coastline.geojson') // Replace with your GeoJSON URL or local path
            .then(response => response.json())
            .then(data => {
                // Add the GeoJSON layer to the map
                 obalna_linija=L.geoJSON(data, {
                    style: {
                        "color": "#ff7800",
                        "weight": 5,
                        "opacity": 0.65
                    }
                });
                            ctlLayers.addOverlay(obalna_linija, "Obalna linija");

            })
            .catch(error => console.error('Error fetching the GeoJSON:', error));

        var obala_poligon;
fetch('obalna_linija_fixed.geojson')
    .then(response => response.json())
    .then(data => {
        obala_poligon = L.geoJSON(data, {
            style: {
                color: "#3388ff",
                weight: 6,
                fillColor: "#3388ff",
                fillOpacity: 0.5
            },
            onEachFeature: function (feature, layer) {
                // Store the default style
                var defaultStyle = {
                    color: "#3388ff",
                    weight: 6,
                    fillColor: "#3388ff",
                    fillOpacity: 0.5
                };

                // Define hover style
                var hoverStyle = {
                    color: "#ff7800",
                    weight: 3,
                    fillColor: "#ff7800",
                    fillOpacity: 0.7
                };

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

                // Add mouseover and mouseout events
                layer.on('mouseover', function () {
                    layer.setStyle(hoverStyle);
                });

                layer.on('mouseout', function () {
                    layer.setStyle(defaultStyle); // Reset to default style
                });
            }
        });

        ctlLayers.addOverlay(obala_poligon, "Obala fixed");
    });

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
                    return { color: 'blue',weight: 4 };
                },
               layerName:'CARLIT_V2',
                onEachFeature: function (feature, layer) {
                    layer.on('click', function (e) {
                        L.DomEvent.stopPropagation(e);
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

                                // On hover (mouseover) event to change color
            layer.on('mouseover', function () {
                layer.setStyle({
                    color: 'red',   // Change color on hover
                    weight: 6       // Optional: make it bolder on hover
                });
            });

            // On hover out (mouseout) event to reset to default style
            layer.on('mouseout', function () {
                geojsonLayer.resetStyle(layer); // Reset to the default style
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
      

 

            ctlLayers.addOverlay(geojsonLayer, "Carlit_v2");

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

let uploadedGeojson = null;

// Function to handle file uploads
function handleFiles(files) {
    if (files.length === 0) return;

    const file = files[0];
    if (file && (file.type === "application/json" || file.name.endsWith(".geojson") || file.name.endsWith(".json"))) {
        console.log('File selected:', file);

        const reader = new FileReader();
        reader.onload = (event) => {
            const fileContent = event.target.result;  // Get file content
            const fileContentJSON = JSON.parse(fileContent, null, 2); 
            console.log('File content:', fileContentJSON);  // Log file content

            try {
                const geojson2 = fileContentJSON;

                if (isValidGeoJSON(geojson2)) {
                    
                    addGeoJSONUploadLayer(geojson2);  // Use the function to add the layer
                    document.getElementById('upload-status').textContent = "File uploaded and parsed successfully.";
                } else {
                    alert("Uploaded GeoJSON is not valid.");
                    document.getElementById('upload-status').textContent = "Uploaded GeoJSON is not valid.";
                }
            } catch (e) {
                console.error("Failed to parse GeoJSON:", e);
                alert("Error parsing GeoJSON file.");
                document.getElementById('upload-status').textContent = "Error parsing GeoJSON file.";
            }
        };
        reader.onerror = (error) => {
            console.error('File reading error:', error);
            alert('Error reading file.');
            document.getElementById('upload-status').textContent = "Error reading file.";
        };
        reader.readAsText(file);  // Read file content as text
    } else {
        alert("Please upload a valid GeoJSON file.");
        document.getElementById('upload-status').textContent = "Please upload a valid GeoJSON file.";
    }
}

// Function to validate GeoJSON
function isValidGeoJSON(geojson) {
    // Basic validation checks
    if (!geojson || typeof geojson !== 'object') return false;
    if (!geojson.type || geojson.type !== 'FeatureCollection') return false;
    if (!geojson.features || !Array.isArray(geojson.features)) return false;
    return true;
}

// Function to add the uploaded GeoJSON layer to the map
function addGeoJSONUploadLayer(geojson) {
    // Remove the previous GeoJSON layer if it exists
    if (uploadedGeojson) {
        map.removeLayer(uploadedGeojson);
        ctlLayers.removeLayer(uploadedGeojson);
    }

    // Add the new GeoJSON layer to the map
    uploadedGeojson = L.geoJson(geojson, {
        onEachFeature: function (feature, layer) {
            layer.on('click', function () {
             //L.DomEvent.stopPropagation(e);

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
        },
        style: function (feature) {
            return {
                color: "#ff7800",
                weight: 5,
                opacity: 0.65
            };
        }
    }).addTo(map);

    // Add the layer to the overlay control
    ctlLayers.addOverlay(uploadedGeojson, "Uploaded GeoJSON");

        // Zoom to the bounds of the GeoJSON data
    const bounds = uploadedGeojson.getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds);
    }
}

// Event listeners for file input
document.getElementById('fileElem').addEventListener('change', (event) => {
    handleFiles(event.target.files);  // Directly call handleFiles with the selected files
});


// Event listeners for drag-and-drop functionality
const dropArea = document.getElementById('drop-area');
const fileElem = document.getElementById('fileElem');

// Drag and drop events
dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropArea.classList.add('hover');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('hover');
});

dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    dropArea.classList.remove('hover');
    handleFiles(event.dataTransfer.files);  // Directly call handleFiles with the dropped files
});

// Handle file selection via the file input
document.getElementById('fileSelect').addEventListener('click', () => {
    fileElem.click();
});

fileElem.addEventListener('change', (event) => {
    handleFiles(event.target.files);  // Directly call handleFiles with the selected files
});
 
//__________



var geojsonMarkerOptions = {
    radius: 5,
    fillColor:getRandomColor(),
    color: getRandomColor(),
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};



let currentClusteredData = null; // Globalna varijabla za čuvanje podataka trenutnog klastera

fetch('/data')
    .then(response => response.json())
    .then(files => {
        files.forEach(file => {
            fetch(file)
                .then(response => response.json())
                .then(data => {
                    if (data.features.length > 0) {
                        const geometryType = data.features[0].geometry.type;
                        const layerName = file.split('/').pop().split('.geojson')[0];

                        // Handle Point geometries
                        if (geometryType === "Point") {
                            // Generate a random color for this layer
                            const randomColor = getRandomColor();

                            const markers = L.markerClusterGroup();

                            // Set geojsonMarkerOptions with the random color
                            const geojsonMarkerOptions = {
                                radius: 14,
                                fillColor: randomColor,
                                color: "#000",
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.8
                            };

                            const vanjski = L.geoJSON(data, {
                                layerName: layerName,
                                pointToLayer: function (feature, latlng) {
                                    // Kreiranje CircleMarker i dodavanje originalnog feature-a kao deo marker objekta
                                    const marker = L.circleMarker(latlng, geojsonMarkerOptions);
                                    marker.feature = feature; // Čuvanje feature objekta u markeru
                                    return marker;
                                },
                                onEachFeature: function (feature, layer) {
                                    layer.on('click', function (e) {
                                    console.log(e)
                                    	L.DomEvent.stopPropagation(e);

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
                            });

                            // Dodaj geojson sloj u marker cluster grupu
                            markers.addLayer(vanjski);

                
                            // Dodaj događaj za klik na cluster
                            markers.on('clusterclick', function (a) {

                                const clusteredFeatures = [];
                                var number=a.sourceTarget._childCount
                                const clusterCount = document.getElementById('clusterCount');
                                clusterCount.textContent = number; // Update the number in the icon stack

                                 clusterCount.classList.add('fa-beat-fade');
                                 
                               // Pronađi element sa ID-jem 'btnDatabase'
                            var btnDatabase = document.getElementById('btnDatabase');

                            // Pronađi roditelja tog elementa (koji je <li> element)
                            var parentLi = btnDatabase.parentElement;

                            // Ukloni klasu 'disabled' sa <li> elementa
                            parentLi.classList.remove('disabled');
                                a.layer.getAllChildMarkers().forEach(function (marker) {
                                    if (marker.feature) {
                                        clusteredFeatures.push(marker.feature);
                                    }
                                });

                                // Sačuvaj podatke o trenutnom klasteru u globalnu varijablu
                                currentClusteredData = {
                                    type: "FeatureCollection",
                                    features: clusteredFeatures
                                };

                                // downloadGeoJSON(currentClusteredData);
                            });

                            ctlLayers.addOverlay(markers, layerName.toString());
                        }
                    }
                })
                .catch(error => console.error('Error loading GeoJSON:', error));
        });
    })
    .catch(error => console.error('Error fetching GeoJSON file list:', error));




    map.on('click', function (e) {

     // Pronađi element sa ID-jem 'btnDatabase'
var btnDatabase = document.getElementById('btnDatabase');

// Pronađi roditelja tog elementa (koji je <li> element)
var parentLi = btnDatabase.parentElement;

// Dodaj klasu 'disabled' na <li> element
parentLi.classList.add('disabled');


 const clusterCount = document.getElementById('clusterCount');
    clusterCount.textContent = ''; // Clear the number
currentClusteredData = null;
});

// Function to generate a random color in hex format
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Function to download data as GeoJSON
function downloadGeoJSON(geojson) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson));
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'cluster_data.geojson');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Pronađi element sa ID-jem 'btnDatabase'
var btnDatabase = document.getElementById('btnDatabase');

// Pronađi roditelja tog elementa (koji je <li> element)
var parentLi = btnDatabase.parentElement;

// Dodaj klasu 'disabled' na <li> element
parentLi.classList.add('disabled');
}

// Dodavanje događaja na dugme za preuzimanje
document.getElementById('btnDatabase').addEventListener('click', function (e) {
    e.preventDefault(); // Sprečavanje defaultnog ponašanja
sidebar.close('database')


    // Provjeri je li sačuvan neki klaster
    if (currentClusteredData) {
   
        downloadGeoJSON(currentClusteredData);

    } else {
        alert('Nema odabranog klastera za preuzimanje.');
    }
});

//_____________gps__________________________

    let locationPoint, locationCircle;
let firstZoom = true;
    // Function to handle geolocation
    function handleGeolocation(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy; // Accuracy in meters

        if (!isSolid) return; // If the button is off, do nothing

        // Remove existing point and circle if they exist
        if (locationPoint) {
            map.removeLayer(locationPoint);
        }
        if (locationCircle) {
            map.removeLayer(locationCircle);
        }

        // Create a point at the user's location
        locationPoint = L.circleMarker([lat, lng], {
            radius: 5,
            color: '#007bff', // Point color
            fillColor: '#007bff',
            fillOpacity: 1
        }).addTo(map);

        // Create a circle around the point based on accuracy
        locationCircle = L.circle([lat, lng], {
            radius: accuracy, // Use the accuracy value for the circle radius
            color: '#007bff', // Circle color
            fillColor: '#007bff',
            fillOpacity: 0.2
        }).addTo(map);

        if (firstZoom) {
            map.setView([lat, lng], 15, { animate: true });
            firstZoom = false; // Set flag to false after the first zoom
        } else {
            map.setView(map.getCenter(), map.getZoom(), { animate: false });
        }
    }

    // Function to start geolocation tracking
    function startGeolocation() {
        if (navigator.geolocation) {
        console.log(navigator.geolocation.watchPosition)
            navigator.geolocation.watchPosition(handleGeolocation, (error) => {
                console.error('Error getting location:', error);
            }, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            });
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    }
   function stopGeolocation() {
        if (locationPoint) {
            map.removeLayer(locationPoint);
            locationPoint = null;
        }
        if (locationCircle) {
            map.removeLayer(locationCircle);
            locationCircle = null;
        }
             firstZoom = true;
    }




  let isSolid = false;
document.getElementById('gps').addEventListener('click', function (e) {
sidebar.close('gps')

    const icon = this.querySelector('i');
        if (isSolid) {
       stopGeolocation();
            // Change icon to fa-regular
            icon.classList.remove('fa-solid', 'fa-compass');
            icon.classList.add('fa-regular', 'fa-compass');
        } else {
          startGeolocation();
            // Change icon to fa-solid
            icon.classList.remove('fa-regular', 'fa-compass');
            icon.classList.add('fa-solid', 'fa-compass');
        }

        // Update the state
        isSolid = !isSolid;


map.setView(map.getCenter(), map.getZoom(), { animate: false });

})



let isSolidPrint = true; // Initial state
var browserControl
document.getElementById('print').addEventListener('click', function (e) {
    sidebar.close('print');

    const icon2 = this.querySelector('i'); // Find the <i> element inside the button

    // Check if icon exists
    if (icon2) {
        if (isSolidPrint) {
       
            // Change icon to fa-regular
            icon2.classList.remove('fa-regular', 'fa-map');
            icon2.classList.add('fa-solid', 'fa-map'); // Change to new icon
             browserControl = L.control.browserPrint({
            position:'topright'
            }).addTo(map);

           
        } else {
            // Change icon to fa-duotone fa-solid
            icon2.classList.remove('fa-solid', 'fa-map');
            icon2.classList.add('fa-regular', 'fa-map'); // Revert to default
            map.removeControl(browserControl);

        }
        // Update the state
        isSolidPrint = !isSolidPrint;
    }

     map.setView(map.getCenter(), map.getZoom(), { animate: false });
});



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
