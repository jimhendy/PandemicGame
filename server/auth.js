// One shared password for the whole site, to keep out bots and the curious.
// Logging in sets a cookie that lasts a year, so each browser only asks once.

const crypto = require('crypto');
const express = require('express');

const appPassword = process.env.APP_PASSWORD || '';
const COOKIE = 'pandemic_auth';
const PLAYER_COOKIE = 'pandemic_player'; // who you are, so a refresh rejoins your seat
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;

// Signs the cookie. Without SECRET_KEY everyone is logged out on restart.
const secretKey = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex');
if (appPassword && !process.env.SECRET_KEY) {
    console.warn('SECRET_KEY not set: logins will not survive a restart');
}
// Includes the password, so changing it logs everyone out.
const token = crypto.createHmac('sha256', secretKey).update('site-ok:' + appPassword).digest('hex');
const failures = new Map();

function safeEqual(a, b) {
    const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
    return crypto.timingSafeEqual(hash(a), hash(b));
}

function readCookie(req, name) {
    for (const part of (req.headers.cookie || '').split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) return value.join('=');
    }
    return '';
}

function isAuthorised(req) {
    return !appPassword || safeEqual(readCookie(req, COOKIE), token);
}

// Only same-site paths, and never back to the login page.
function safeNext(target) {
    if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/login')) return '/';
    return target;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loginPage(res, next, error = '', status = 200) {
    const message = error ? `<p class="err">${escapeHtml(error)}</p>` : '';
    res.status(status).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Pandemic</title>
<link rel="icon" href="/images/favicon.ico">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;color:#e9eef5;
background:radial-gradient(1200px 700px at 50% 20%,#10345a 0%,transparent 70%),#071526;padding:16px;box-sizing:border-box}
form{width:min(380px,100%);background:rgba(13,34,56,.85);border-color:rgba(120,200,255,.18);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px 28px;
display:flex;flex-direction:column;gap:14px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.5)}
h1{margin:0;font-size:2.2rem;letter-spacing:.08em;color:#cfe9ff;text-shadow:0 0 18px rgba(79,209,255,.6)} p{margin:0;color:#8ea5bf}
input{font:1rem system-ui,sans-serif;color:#e9eef5;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:11px 12px}
input:focus{outline:none;border-color:#4fd1ff;box-shadow:0 0 0 3px rgba(79,209,255,.2)}
button{font:600 1rem system-ui,sans-serif;background:#e0533d;color:#fff;border:0;border-radius:10px;padding:11px;cursor:pointer}
button:hover{background:#f06a52} .err{color:#ff8a8a}
</style></head><body><form method="post" action="/login">
<h1>PANDEMIC</h1><p>Enter the password to play.</p>${message}
<input type="password" name="password" aria-label="Password" placeholder="Password" autofocus required>
<input type="hidden" name="next" value="${escapeHtml(safeNext(next))}"><button type="submit">Come in</button>
</form></body></html>`);
}

function clientIp(req) {
    return req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '?';
}

function login(req, res) {
    const next = req.body.next;
    const ip = clientIp(req);
    const now = Date.now();
    const attempts = (failures.get(ip) || []).filter((t) => now - t < FAILURE_WINDOW_MS);
    failures.set(ip, attempts);
    if (attempts.length >= MAX_FAILURES) {
        return loginPage(res, next, 'Too many wrong passwords. Try again in a few minutes.', 429);
    }
    if (!safeEqual(req.body.password || '', appPassword)) {
        attempts.push(now);
        return loginPage(res, next, "That's not it.", 401);
    }
    failures.delete(ip);
    // Secure is fine locally too: browsers accept Secure cookies on http://localhost.
    res.cookie(COOKIE, token, { maxAge: MAX_AGE_MS, httpOnly: true, sameSite: 'lax', secure: true });
    res.redirect(safeNext(next));
}

function playerId(req) {
    const id = readCookie(req, PLAYER_COOKIE);
    return /^[A-Za-z0-9_-]{16,64}$/.test(id) ? id : null;
}

// Routes for /login, then a gate in front of everything else, then a player id for everyone let in.
function protect(app) {
    app.get('/login', (req, res) => {
        if (isAuthorised(req)) return res.redirect(safeNext(req.query.next));
        loginPage(res, req.query.next);
    });
    app.post('/login', express.urlencoded({ extended: false }), login);
    app.use((req, res, next) => {
        if (isAuthorised(req)) return next();
        loginPage(res, req.originalUrl);
    });
    app.use((req, res, next) => {
        if (!playerId(req)) {
            res.cookie(PLAYER_COOKIE, crypto.randomBytes(18).toString('base64url'),
                { maxAge: MAX_AGE_MS, httpOnly: true, sameSite: 'lax', secure: true });
        }
        next();
    });
}

module.exports = { isAuthorised, playerId, protect, safeEqual };
