require('dotenv').config();
const { Client } = require('pg');
const { URL } = require('url');

let dbConfig = {
    user: 'postgres',
    host: 'localhost',
    password: '0728',
    port: 5432,
    database: 'postgres' // Connect to default db first
};

if (process.env.DATABASE_URL) {
    try {
        const parsedUrl = new URL(process.env.DATABASE_URL);
        dbConfig.user = parsedUrl.username || dbConfig.user;
        dbConfig.password = parsedUrl.password ? decodeURIComponent(parsedUrl.password) : dbConfig.password;
        dbConfig.host = parsedUrl.hostname || dbConfig.host;
        dbConfig.port = parsedUrl.port || dbConfig.port;
        dbConfig.database = 'postgres'; // Always connect to default db first to check/create the target database
    } catch (e) {
        console.error('Failed to parse DATABASE_URL, using default config:', e.message);
    }
}

const client = new Client(dbConfig);

async function createDb() {
    try {
        await client.connect();
        const res = await client.query("SELECT datname FROM pg_catalog.pg_database WHERE datname = 'skillforge_db'");
        
        if (res.rowCount === 0) {
            console.log("Database 'skillforge_db' not found, creating it.");
            await client.query('CREATE DATABASE skillforge_db');
            console.log("Database 'skillforge_db' created successfully.");
        } else {
            console.log("Database 'skillforge_db' already exists.");
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDb();
