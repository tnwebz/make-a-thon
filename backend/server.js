require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { sequelize } = require('./models');

const app = express();
const server = http.createServer(app);

// CORS Configuration supporting LAN (192.168.x.x, 10.x.x.x) and Localhost
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const isAllowed = 
            origin.startsWith('http://localhost') ||
            origin.startsWith('http://127.0.0.1') ||
            origin.startsWith('http://192.168.') ||
            origin.startsWith('http://10.') ||
            (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL);
        return callback(null, isAllowed);
    },
    credentials: true
};

// Socket.IO setup with CORS
const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST']
    }
});

const path = require('path');

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/v1', require('./routes/auth'));
app.use('/api/v1', require('./routes/misc'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/courses', require('./routes/courses'));
app.use('/api/v1/code-tests', require('./routes/digital_skills'));
app.use('/api/v1/content', require('./routes/content'));
app.use('/api/v1/user', require('./routes/user'));
app.use('/api/v1/assignments', require('./routes/assignments'));
app.use('/api/v1/profile', require('./routes/profile'));
app.use('/api/v1/offline', require('./routes/offline_sharing'));
app.use('/api/v1/share-sessions', require('./routes/share_sessions'));

// 🎬 Mobile App Video Player — serves Plyr with a real HTTP origin
// YouTube blocks embedding from null/about:blank origins (React Native WebView inline HTML)
// This endpoint gives the WebView a proper origin so YouTube embedding works
app.get('/player/:videoId', (req, res) => {
    const { videoId } = req.params;
    // Sanitize videoId to prevent XSS
    const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #000; }
    .plyr { width: 100%; height: 100%; }
    .plyr__video-embed iframe { 
      top: -50% !important; 
      height: 200% !important; 
    }
    :root { --plyr-color-main: #ffffff; }
    .plyr__control--overlaid { 
      background: rgba(255,255,255,0.1) !important; 
      backdrop-filter: blur(10px); 
      color: white !important; 
      border: 1px solid rgba(255,255,255,0.2); 
    }
    .plyr__control--overlaid:hover { background: rgba(255,255,255,0.2) !important; }
  </style>
</head>
<body>
  <div id="player" data-plyr-provider="youtube" data-plyr-embed-id="${safeId}"></div>
  <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
  <script>
    const player = new Plyr('#player', {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume'],
      youtube: {
        noCookie: true,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        disablekb: 1
      },
      autoplay: true
    });
  </script>
</body>
</html>`);
});

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillForge Node.js API is running' });
});

// ============================================
// Socket.IO: ShareHub Room Code Logic
// ============================================
const activeRooms = {};

io.on('connection', (socket) => {
    console.log(`📡 ShareHub: Client connected (${socket.id})`);

    // Sender creates a room
    socket.on('create-room', (data) => {
        // Generate a unique 4-digit code
        let code;
        do {
            code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (activeRooms[code]);

        activeRooms[code] = {
            senderSocketId: socket.id,
            filename: data.filename,
            title: data.title,
            fileSize: data.fileSize,
            thumbnail: data.thumbnail || '',
            createdAt: Date.now()
        };

        socket.join(`room-${code}`);
        socket.emit('room-created', { code });
        console.log(`📤 Room ${code} created by ${socket.id} for "${data.title}"`);
    });

    // Receiver joins a room with code
    socket.on('join-room', (data) => {
        const { code } = data;
        const room = activeRooms[code];

        if (!room) {
            socket.emit('room-error', { message: 'Invalid room code. Please check and try again.' });
            return;
        }

        socket.join(`room-${code}`);
        
        // Tell the receiver the file details + download URL
        socket.emit('room-joined', {
            title: room.title,
            fileSize: room.fileSize,
            thumbnail: room.thumbnail,
            downloadUrl: `/api/v1/offline/downloads/${room.filename}`
        });

        // Notify the sender that someone joined
        io.to(room.senderSocketId).emit('peer-joined', {
            receiverId: socket.id,
            code
        });

        console.log(`📥 ${socket.id} joined room ${code}`);
    });

    // Receiver notifies transfer complete
    socket.on('transfer-complete', (data) => {
        const { code } = data;
        const room = activeRooms[code];
        if (room) {
            io.to(room.senderSocketId).emit('transfer-done', {
                receiverId: socket.id,
                code
            });
            console.log(`✅ Transfer complete in room ${code}`);
        }
    });

    // Sender closes a room
    socket.on('close-room', (data) => {
        const { code } = data;
        if (activeRooms[code]) {
            io.to(`room-${code}`).emit('room-closed');
            delete activeRooms[code];
            console.log(`🚪 Room ${code} closed`);
        }
    });

    // Clean up rooms when sender disconnects
    socket.on('disconnect', () => {
        for (const [code, room] of Object.entries(activeRooms)) {
            if (room.senderSocketId === socket.id) {
                io.to(`room-${code}`).emit('room-closed');
                delete activeRooms[code];
                console.log(`🚪 Room ${code} auto-closed (sender disconnected)`);
            }
        }
        console.log(`📡 ShareHub: Client disconnected (${socket.id})`);
    });
});

// Clean up stale rooms every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of Object.entries(activeRooms)) {
        if (now - room.createdAt > 30 * 60 * 1000) { // 30 min timeout
            io.to(`room-${code}`).emit('room-closed');
            delete activeRooms[code];
        }
    }
}, 10 * 60 * 1000);

// Sync Database and Start the server
const PORT = process.env.PORT || 8000;

sequelize.sync({ alter: true })
    .then(() => {
        console.log('✅ PostgreSQL Database connected and synchronized.');
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📡 Socket.IO ready for ShareHub connections`);
        });
    })
    .catch(err => {
        console.error('❌ Failed to sync database:', err);
    });
