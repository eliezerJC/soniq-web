import { loginWithSpotify, handleRedirect, getToken, logout } from './auth.js';

// ====== UI refs ======
const loginBtn = document.getElementById('loginBtn');
const configBtn = document.getElementById('configBtn');
const configDialog = document.getElementById('configDialog');
const closeConfig = document.getElementById('closeConfig');

const themeSelect = document.getElementById('themeSelect');
const accentInput = document.getElementById('accentInput');
const fontSelect  = document.getElementById('fontSelect');
const langSelect  = document.getElementById('langSelect');
const qualitySelect = document.getElementById('qualitySelect');

const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

const homePlaylists = document.getElementById('homePlaylists');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const results = document.getElementById('results');

const meName = document.getElementById('meName');
const meId   = document.getElementById('meId');

const audio = document.getElementById('audio');
const cover = document.getElementById('cover');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const bars = document.getElementById('bars');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progress = document.getElementById('progress');

let queue = [];
let currentIndex = -1;

// ====== Animación cambio de vista ======
navBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    navBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const viewId = 'view-' + btn.dataset.view;
    views.forEach(v=>{
      v.classList.toggle('active', v.id === viewId);
    });
  });
});

// ====== Configuración (tema, color, fuente) ======
const PREF_KEY = 'soniq_prefs';
function loadPrefs(){
  const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  const { theme='light', accent='#00bcd4', font=`'Poppins', sans-serif`, lang='es', quality='high'} = saved;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--font', font);
  themeSelect.value = theme; accentInput.value = accent; fontSelect.value = font;
  langSelect.value = lang; qualitySelect.value = quality;
}
function savePrefs(){
  const prefs = {
    theme: themeSelect.value,
    accent: accentInput.value,
    font: fontSelect.value,
    lang: langSelect.value,
    quality: qualitySelect.value
  };
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}
loadPrefs();

themeSelect.onchange = ()=>{ 
  document.documentElement.setAttribute('data-theme', themeSelect.value); 
  savePrefs();
};
accentInput.oninput = ()=>{ 
  document.documentElement.style.setProperty('--accent', accentInput.value);
  savePrefs();
};
fontSelect.onchange = ()=>{
  document.documentElement.style.setProperty('--font', fontSelect.value);
  savePrefs();
};
langSelect.onchange = savePrefs;
qualitySelect.onchange = savePrefs;

configBtn.onclick = ()=> configDialog.showModal();
closeConfig.onclick = ()=> configDialog.close();

// ====== Spotify Auth Flow ======
loginBtn.onclick = async ()=>{
  if(getToken()) { logout(); return; }
  await loginWithSpotify();
};

(async ()=>{
  const token = await handleRedirect() || getToken();
  if(token){
    loginBtn.textContent = 'Cerrar sesión';
    await loadMe(token);
    await loadFeatured(token);
  }else{
    loginBtn.textContent = 'Iniciar sesión con Spotify';
  }
})();

// ====== Llamadas a la API de Spotify ======
async function apiGET(path, token, params={}){
  const url = new URL(`https://api.spotify.com/v1/${path}`);
  Object.entries(params).forEach(([k,v])=> url.searchParams.set(k,v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
  if(!res.ok) throw new Error('API error');
  return res.json();
}

async function loadMe(token){
  const me = await apiGET('me', token);
  meName.textContent = me.display_name || 'Usuario';
  meId.textContent = me.id;
}

async function loadFeatured(token){
  // Listas destacadas (home)
  const { playlists } = await apiGET('browse/featured-playlists', token, { country:'US', limit:12 });
  homePlaylists.innerHTML = '';
  playlists.items.forEach(pl=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" src="${pl.images?.[0]?.url || ''}" alt="">
      <div class="title">${pl.name}</div>
      <div class="sub">${pl.tracks.total} canciones</div>
    `;
    card.onclick = async ()=>{
      const full = await apiGET(`playlists/${pl.id}/tracks`, token, { limit: 50 });
      queue = (full.items || [])
        .map(it=>it.track)
        .filter(t=>t && t.preview_url) // preview de 30s
        .map(t=>({
          id: t.id,
          name: t.name,
          artist: t.artists.map(a=>a.name).join(', '),
          cover: t.album?.images?.[0]?.url || '',
          preview: t.preview_url
        }));
      if(queue.length>0){ currentIndex = 0; playAt(currentIndex); }
      // abrir vista search para ver resultados en mismo grid
      navBtns.forEach(b=>b.classList.remove('active'));
      document.querySelector('[data-view="search"]').classList.add('active');
      views.forEach(v=>v.classList.remove('active'));
      document.getElementById('view-search').classList.add('active');
      renderTracks(queue);
    };
    homePlaylists.appendChild(card);
  });
}

function renderTracks(list){
  results.innerHTML = '';
  list.forEach((t, idx)=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" src="${t.cover}" alt="">
      <div class="meta">
        <div class="title">${t.name}</div>
        <div class="sub">${t.artist}</div>
      </div>
      <button class="icon-btn">▶️</button>
    `;
    card.onclick = ()=>{ currentIndex = idx; playAt(currentIndex); };
    results.appendChild(card);
  });
}

// Búsqueda
searchBtn.onclick = async ()=>{
  const token = getToken(); if(!token) return alert('Inicia sesión con Spotify');
  const q = searchInput.value.trim(); if(!q) return;
  const data = await apiGET('search', token, { q, type:'track', limit:30 });
  queue = (data.tracks.items || [])
    .filter(t=>t.preview_url)
    .map(t=>({
      id: t.id,
      name: t.name,
      artist: t.artists.map(a=>a.name).join(', '),
      cover: t.album?.images?.[0]?.url || '',
      preview: t.preview_url
    }));
  renderTracks(queue);
};

// ====== Reproductor (previews de 30s) ======
function playAt(i){
  const t = queue[i]; if(!t) return;
  audio.src = t.preview;
  audio.play().catch(()=>{});
  cover.src = t.cover;
  trackTitle.textContent = t.name;
  trackArtist.textContent = t.artist;
  playBtn.textContent = '⏸️';
  bars.classList.add('playing');
}

playBtn.onclick = ()=>{
  if(audio.paused){ audio.play(); playBtn.textContent='⏸️'; }
  else { audio.pause(); playBtn.textContent='▶️'; }
};
prevBtn.onclick = ()=>{ if(queue.length){ currentIndex = (currentIndex-1+queue.length)%queue.length; playAt(currentIndex); } };
nextBtn.onclick = ()=>{ if(queue.length){ currentIndex = (currentIndex+1)%queue.length; playAt(currentIndex); } };

audio.ontimeupdate = ()=>{
  if(!audio.duration) return;
  progress.value = Math.floor((audio.currentTime / audio.duration) * 100);
};
progress.oninput = ()=>{
  if(audio.duration){
    audio.currentTime = (progress.value/100) * audio.duration;
  }
};

// Estética: barras se “mueven” al reproducir
audio.addEventListener('play', ()=> bars.style.opacity = '1');
audio.addEventListener('pause',()=> bars.style.opacity = '.5');
