// ==== CONFIGURAR ESTO ====
// 1) Crea tu app en https://developer.spotify.com/dashboard
// 2) Añade tu Redirect URI (ej: https://tuusuario.github.io/soniq-web/)
// 3) Pon aquí tu CLIENT_ID y REDIRECT_URI:
const CLIENT_ID = "TU_CLIENT_ID_DE_SPOTIFY";
const REDIRECT_URI = "https://tuusuario.github.io/soniq-web/"; // cambia al tuyo

// Scopes mínimos para leer catálogo
const SCOPES = [
  "user-read-email",
  "user-read-private"
];

function base64UrlEncode(str){
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function sha256(verifier){
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return digest;
}

function generateCodeVerifier(length=128){
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let value = '';
  for(let i=0;i<length;i++) value += possible.charAt(Math.floor(Math.random()*possible.length));
  return value;
}

async function generateCodeChallenge(verifier){
  const hashed = await sha256(verifier);
  return base64UrlEncode(hashed);
}

export async function loginWithSpotify(){
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES.join(' '),
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });

  window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function handleRedirect(){
  const code = new URLSearchParams(window.location.search).get('code');
  if(!code) return null;

  const verifier = localStorage.getItem('pkce_verifier');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body
  });
  if(!res.ok) return null;
  const data = await res.json();
  localStorage.setItem('access_token', data.access_token);
  history.replaceState({}, document.title, window.location.pathname); // limpia ?code=
  return data.access_token;
}

export function getToken(){
  return localStorage.getItem('access_token');
}

export function logout(){
  localStorage.removeItem('access_token');
  localStorage.removeItem('pkce_verifier');
  localStorage.removeItem('soniq_prefs');
  location.reload();
}
