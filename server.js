const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    maxHttpBufferSize: 1e8 // 100MB для голосовых сообщений
});

app.use(express.static(path.join(__dirname, 'public')));

// Хранилище сообщений (в памяти)
const messages = [];
const users = new Set();
const MAX_MESSAGES = 100;

io.on('connection', (socket) => {
    console.log('Новый пользователь подключился:', socket.id);
    
    socket.emit('chat history', messages);
    socket.emit('users list', Array.from(users));
    
    socket.on('set username', (username) => {
        if (username && username.trim()) {
            socket.username = username.trim();
            users.add(socket.username);
            
            io.emit('user joined', {
                username: socket.username,
                users: Array.from(users)
            });
            
            console.log(`Пользователь ${socket.username} подключился`);
        }
    });
    
    // Текстовые сообщения
    socket.on('chat message', (data) => {
        if (socket.username && data.message && data.message.trim()) {
            const messageData = {
                id: Date.now(),
                username: socket.username,
                message: data.message.trim(),
                timestamp: new Date().toISOString(),
                type: 'text'
            };
            
            messages.push(messageData);
            if (messages.length > MAX_MESSAGES) messages.shift();
            io.emit('chat message', messageData);
            console.log(`Сообщение от ${socket.username}: ${messageData.message}`);
        }
    });
    
    // Голосовые сообщения
    socket.on('voice message', (data) => {
        if (socket.username && data.audioData && data.audioData.length > 0) {
            const messageData = {
                id: Date.now(),
                username: socket.username,
                audioData: data.audioData,
                duration: data.duration || 0,
                timestamp: new Date().toISOString(),
                type: 'voice'
            };
            
            messages.push(messageData);
            if (messages.length > MAX_MESSAGES) messages.shift();
            io.emit('voice message', messageData);
            console.log(`Голосовое сообщение от ${socket.username}, длительность: ${data.duration} сек`);
        }
    });
    
    socket.on('typing start', () => {
        if (socket.username) {
            socket.broadcast.emit('user typing', {
                username: socket.username,
                isTyping: true
            });
        }
    });
    
    socket.on('typing stop', () => {
        if (socket.username) {
            socket.broadcast.emit('user typing', {
                username: socket.username,
                isTyping: false
            });
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.username) {
            users.delete(socket.username);
            io.emit('user left', {
                username: socket.username,
                users: Array.from(users)
            });
            console.log(`Пользователь ${socket.username} отключился`);
        }
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});