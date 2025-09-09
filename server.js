const express = require('express');
const mysql = require('mysql2');
const DiscordOauth2 = require('discord-oauth2');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.connect(err => {
    if (err) console.error('DB connectie fout:', err);
    else console.log('DB verbonden');
});

const oauth = new DiscordOauth2({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI
});

async function verifyAdmin(req, res, next) {
    const { access_token } = req.session;
    if (!access_token) return res.status(401).json({ error: 'Niet ingelogd' });

    try {
        const user = await oauth.getUser(access_token);
        const guilds = await oauth.getUserGuilds(access_token);
        const guild = guilds.find(g => g.id === process.env.DISCORD_GUILD_ID);
        if (!guild) return res.status(403).json({ error: 'Geen toegang tot server' });

        const member = await oauth.getGuildMember(process.env.DISCORD_GUILD_ID, user.id, access_token);
        const hasAdminRole = member.roles.includes(process.env.ADMIN_ROLE_ID);
        if (!hasAdminRole) return res.status(403).json({ error: 'Geen admin rol' });

        req.user = user;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Verificatie mislukt' });
    }
}

app.get('/auth/discord', (req, res) => {
    const authUrl = oauth.generateAuthUrl({
        scope: ['identify', 'guilds', 'guilds.members'],
        state: 'state123'
    });
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Geen code' });

    try {
        const tokenData = await oauth.tokenRequest({
            code,
            scope: 'identify guilds guilds.members',
            grantType: 'authorization_code'
        });
        req.session.access_token = tokenData.access_token;
        res.redirect('/panel');
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: 'Login fout' });
    }
});

app.get('/api/players', verifyAdmin, (req, res) => {
    db.query('SELECT identifier, CONCAT(firstname, " ", lastname) as name, discord_id FROM users ORDER BY name LIMIT 100', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/search-player', verifyAdmin, (req, res) => {
    const { search } = req.body;
    db.query(
        'SELECT identifier, CONCAT(firstname, " ", lastname) as name, discord_id FROM users WHERE identifier LIKE ? OR CONCAT(firstname, " ", lastname) LIKE ? OR discord_id LIKE ? LIMIT 20',
        [`%${search}%`, `%${search}%`, `%${search}%`],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        }
    );
});

app.post('/api/create-refund', verifyAdmin, (req, res) => {
    const { player_identifier, player_name, player_discord, type, amount, item_name, vehicle_model, vehicle_plate, reason } = req.body;
    const admin_name = `${req.user.username}#${req.user.discriminator}`;
    const admin_id = req.user.id;

    if (!player_identifier || !type) return res.status(400).json({ error: 'Ontbrekende data' });

    db.query(
        'INSERT INTO refunds (player_identifier, player_name, player_discord, admin_id, admin_name, type, amount, item_name, vehicle_model, vehicle_plate, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [player_identifier, player_name, player_discord || null, admin_id, admin_name, type, parseInt(amount) || null, item_name || null, vehicle_model || null, vehicle_plate || null, reason || null],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            const refundId = result.insertId;
            const details = `Refund gemaakt door ${admin_name}: ${type} (${amount || item_name || vehicle_model || 'onbekend'}) - Reden: ${reason || 'Geen'}`;
            db.query('INSERT INTO refund_logs (refund_id, action, details) VALUES (?, ?, ?)', [refundId, 'created', details]);

            res.json({ success: true, id: refundId });
        }
    );
});

app.get('/api/logs', verifyAdmin, (req, res) => {
    db.query(`
        SELECT r.id, r.player_name, r.type, r.amount, r.item_name, r.vehicle_model, r.reason, r.status, 
               rl.action, rl.details, rl.timestamp 
        FROM refunds r LEFT JOIN refund_logs rl ON r.id = rl.refund_id 
        ORDER BY rl.timestamp DESC LIMIT 50
    `, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/claim-refund', verifyAdmin, (req, res) => {
    const { refund_id } = req.body;
    db.query('UPDATE refunds SET status = "claimed", claimed_at = CURRENT_TIMESTAMP WHERE id = ?', [refund_id], (err, result) => {
        if (err || !result.affectedRows) return res.status(500).json({ error: 'Update fout' });
        db.query('INSERT INTO refund_logs (refund_id, action, details) VALUES (?, ?, ?)', [refund_id, 'claimed', 'Geclaimd in-game']);
        res.json({ success: true });
    });
});

// Serveer frontend
app.use(express.static('client/build'));
app.get('*', (req, res) => {
    if (req.path === '/panel' || req.path.startsWith('/static')) {
        res.sendFile(__dirname + '/client/build/index.html');
    } else {
        res.redirect('/panel');
    }
});

app.listen(PORT, () => console.log(`Server op poort ${PORT}`));
