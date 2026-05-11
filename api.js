const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
require('dotenv').config();

const PORT = process.env.PORT || 9000;
const HOST = '0.0.0.0';

require('events').EventEmitter.defaultMaxListeners = 500;

// ============================================================
// 🍃 CONNEXION MONGODB AU DÉMARRAGE (AVANT TOUT)
// ============================================================
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI manquant dans les variables d\'environnement Heroku !');
    console.error('   Ajoutez-la via : heroku config:set MONGO_URI="mongodb+srv://..."');
    process.exit(1);
}

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
})
.then(() => {
    console.log('✅ [MongoDB] Connecté avec succès !');
    // On charge index.js SEULEMENT après la connexion MongoDB
    const spiderIndex = require('./index.js');
    app.use('/code', spiderIndex.router);
    console.log('✅ [Bot] Sessions WhatsApp en cours de démarrage...');
})
.catch((err) => {
    console.error('❌ [MongoDB] Connexion échouée :', err.message);
    process.exit(1);
});

// Reconnexion automatique MongoDB si coupure
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB] Déconnecté. Tentative de reconnexion...');
    setTimeout(() => {
        mongoose.connect(MONGO_URI).catch(() => {});
    }, 5000);
});
// ============================================================

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html');
});

// ============================================================
// 💓 KEEP-ALIVE : Empêche Heroku de tuer le dyno
// ============================================================
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'alive', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html');
});

app.listen(PORT, HOST, () => {
    console.log(`\n🌟 SNOW-MD Server running on port ${PORT}\n`);
});

// ============================================================
// 💓 AUTO PING INTERNE toutes les 14 minutes
// Empêche Heroku de mettre le dyno en veille
// ============================================================
const APP_URL = process.env.APP_URL; //https://snowbot-f2049a070943.herokuapp.com
if (APP_URL) {
    const https = require('https');
    const http = require('http');
    setInterval(() => {
        const lib = APP_URL.startsWith('https') ? https : http;
        lib.get(`${APP_URL}/health`, (res) => {
            console.log(`[KeepAlive] Ping OK - Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.warn('[KeepAlive] Ping échoué:', err.message);
        });
    }, 14 * 60 * 1000); // toutes les 14 minutes
}
// ============================================================

module.exports = app;
