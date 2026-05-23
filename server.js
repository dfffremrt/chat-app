const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Обслуживание статических файлов из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище сообщений (в памяти)
const messages = [];
const users = new Set();

// Максимальное количество хранимых сообщений
const MAX_MESSAGES = 100;

io.on('connection', (socket) => {
    console.log('Новый пользователь подключился:', socket.id);
    
    // Отправляем новому пользователю историю сообщений
    socket.emit('chat history', messages);
    
    // Отправляем список активных пользователей
    socket.emit('users list', Array.from(users));
    
    // Обработка установки имени пользователя
    socket.on('set username', (username) => {
        if (username && username.trim()) {
            socket.username = username.trim();
            users.add(socket.username);
            
            // Уведомляем всех о новом пользователе
            io.emit('user joined', {
                username: socket.username,
                users: Array.from(users)
            });
            
            console.log(`Пользователь ${socket.username} подключился`);
        }
    });
    
    // Обработка новых сообщений
    socket.on('chat message', (data) => {
        if (socket.username && data.message && data.message.trim()) {
            const messageData = {
                id: Date.now(),
                username: socket.username,
                message: data.message.trim(),
                timestamp: new Date().toISOString(),
                type: 'message'
            };
            
            // Сохраняем сообщение
            messages.push(messageData);
            
            // Ограничиваем количество хранимых сообщений
            if (messages.length > MAX_MESSAGES) {
                messages.shift();
            }
            
            // Отправляем сообщение всем клиентам
            io.emit('chat message', messageData);
            console.log(`Сообщение от ${socket.username}: ${messageData.message}`);
        }
    });
    
    // Обработка начала печати
    socket.on('typing start', () => {
        if (socket.username) {
            socket.broadcast.emit('user typing', {
                username: socket.username,
                isTyping: true
            });
        }
    });
    
    // Обработка прекращения печати
    socket.on('typing stop', () => {
        if (socket.username) {
            socket.broadcast.emit('user typing', {
                username: socket.username,
                isTyping: false
            });
        }
    });
    
    // Обработка отключения пользователя
    socket.on('disconnect', () => {
        if (socket.username) {
            users.delete(socket.username);
            
            // Уведомляем всех о выходе пользователя
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