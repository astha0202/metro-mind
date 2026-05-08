let map;
let markers = {};
let poly = null;
let metroMarker = null;
let currentRoute = [];
let step = 0;
let interval;
let voiceOn = false;

function norm(x){
  return x.toLowerCase().replace(/[^a-z0-9]/g,"");
}

function init(){
  map = L.map('map').setView([28.6139,77.2090],11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
  .addTo(map);

  loadStations();
  trackUser();
}

function loadStations(){
  fetch("/stations")
  .then(r=>r.json())
  .then(d=>{
    let names=[];

    d.stations.forEach(s=>{
      names.push(s.name);

      let m=L.marker([s.lat,s.lng]).addTo(map);
      markers[norm(s.name)] = m;
    });

    setup("originStation","originDropdown",names);
    setup("destinationStation","destinationDropdown",names);
  });
}

function setup(inputId,boxId,data){
  let input=document.getElementById(inputId);
  let box=document.getElementById(boxId);

  input.oninput=()=>{
    let val=input.value.toLowerCase();
    box.innerHTML="";

    if(!val) return;

    data.filter(x=>x.toLowerCase().includes(val))
    .slice(0,8)
    .forEach(x=>{
      let d=document.createElement("div");
      d.className="item";
      d.innerText=x;

      d.onclick=()=>{
        input.value=x;
        box.innerHTML="";
      };

      box.appendChild(d);
    });
  };
}

function findRoute(){
  let o=document.getElementById("originStation").value;
  let d=document.getElementById("destinationStation").value;

  fetch(`/find-route/${o}/${d}`)
  .then(r=>r.json())
  .then(data=>{
    let routesDiv=document.getElementById("routes");
    let detailsDiv=document.getElementById("details");

    routesDiv.innerHTML="";
    detailsDiv.innerHTML="";

    if(poly){
      map.removeLayer(poly);
    }

    if(!data.routes.length){
      routesDiv.innerHTML="No Route Found";
      return;
    }

    data.routes.forEach((r,index)=>{
      let card=document.createElement("div");
      card.className="route-card";

      card.innerHTML=`
        ⏱ ${r.duration} min |
        🚉 ${r.stations_count} |
        🔁 ${r.interchanges}
      `;

      card.onclick=function(){

        if(poly){
          map.removeLayer(poly);
        }

        currentRoute = r.stations;
        step = 0;

        let coords=[];
        let detailsHTML="";

        r.stations.forEach((s,i)=>{
          let m=markers[norm(s)];
          if(m){
            coords.push(m.getLatLng());
          }

          // 🔁 interchange highlight
          let interchange = (i%8==0 && i!=0) ? "🔁 Interchange" : "";

          detailsHTML += `
            <div style="padding:4px;">
              ${i+1}. ${s} ${interchange}
            </div>
          `;
        });

        poly=L.polyline(coords,{
          color:getLineColor(r.stations),
          weight:6
        }).addTo(map);

        map.fitBounds(poly.getBounds());

        detailsDiv.innerHTML = `
          <div class="route-card" style="background:#111;color:white">
            <h3>Route Details</h3>
            <p>⏱ ${r.duration} min (ETA smart)</p>
            <p>🚉 ${r.stations_count} stations</p>
            <p>🔁 ${r.interchanges}</p>
            <hr>${detailsHTML}
          </div>
        `;

        startMetro();
      };

      routesDiv.appendChild(card);
    });
  });
}

// 🎨 COLOR DETECTION
function getLineColor(stations){
  let s = stations.join(" ").toLowerCase();

  if(s.includes("dwarka") || s.includes("noida")) return "#0072BC"; // blue
  if(s.includes("hauz") || s.includes("yellow")) return "yellow";
  if(s.includes("pink")) return "#E91E63";
  return "red";
}

// 🚇 SMOOTH METRO MOVE
function startMetro(){
  if(interval) clearInterval(interval);

  if(metroMarker){
    map.removeLayer(metroMarker);
  }

  metroMarker = L.marker(
    markers[norm(currentRoute[0])].getLatLng(),
    {
      icon: L.divIcon({
        html:"🚇",
        className:"",
        iconSize:[25,25]
      })
    }
  ).addTo(map);

  interval = setInterval(()=>{
    if(step >= currentRoute.length-1){
      speak("Destination reached");
      clearInterval(interval);
      return;
    }

    step++;

    let next = markers[norm(currentRoute[step])].getLatLng();

    metroMarker.setLatLng(next);

    updateLive();

    if(voiceOn){
      speak("Next station " + currentRoute[step]);
    }

  },2000);
}

// 📍 USER LOCATION
function trackUser(){
  navigator.geolocation.watchPosition(pos=>{
    let lat = pos.coords.latitude;
    let lng = pos.coords.longitude;

    L.circle([lat,lng],{
      radius:50,
      color:"green"
    }).addTo(map);
  });
}

// ⏳ LIVE UI
function updateLive(){
  let now = new Date().toLocaleTimeString();

  document.getElementById("liveTime").innerText = now;

  document.getElementById("progress").innerText =
    `Progress: ${step+1}/${currentRoute.length}`;
}

// 🎤 VOICE
function toggleVoice(){
  voiceOn = !voiceOn;
}

function speak(text){
  let msg = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(msg);
}