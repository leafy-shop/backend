
const express = require("express")
const { Server } = require('socket.io');
const { chat, chatRoom } = require("../model/class/mongoose/schema");
require('dotenv').config().parsed
const router = express.Router()

let messageLog = []

router.get("/", (req, res) => {
    const name = req.query.name
    res.render("template", { name: name, username: "Sahathat", message: "Test", messageLog: messageLog })
})

// Route to handle adding new values to the array
router.post('/', (req, res) => {
    const { username, message } = req.body;
    messageLog.push({ username: username, message: message });
    console.log(req.body.message)
    res.redirect('/chat');
});

// set socket
function initializeSocket(server) {
    const io = new Server(server, {cors: {
        origin: process.env.CLIENT_HOST || 'http://localhost:5173',
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', async (socket) => {
        // console.log('A user connected');

        let roomId = "kvsijjsiejvissvd"
        let messageId = new Date()

        // Load previous messages
        await chat.find().then(messages => {
            // console.log(messages)
            socket.emit('load messages', messages);
        })
        .catch(err => {
            console.error('Error retrieving message history:', err);
        });

        socket.on("join", async (data) => {
            // console.log(data)
            const chatRoomList = await chatRoom.find({roomId: data.roomId})
            console.log(chatRoomList)
            if (chatRoomList.length === 0) {
                const newRoom = new chatRoom({ roomId: data.roomId, customer: data.username, supplier: "piraphat", time: messageId });
                newRoom.save().then(() => {
                    io.in(roomId).emit('chat message in roomId ' + data.roomId);// Broadcast message to all clients
                })
                .catch(err => {
                    console.error('Error saving message:', err);
                });
            }
            socket.join(data.roomId);
            socket.broadcast.to(data.roomId).emit("user joined");
        });

        // Listen for messages
        socket.on('chat message', (msg) => {
            // console.log(msg)
            // Create a new user
            const newUser = new chat({ roomId: roomId, messageId: messageId.getTime(), sender: msg.sender, message: msg.message, time: messageId });
            newUser.save().then(() => {
                io.in(roomId).emit('chat message', msg);// Broadcast message to all clients
            })
            .catch(err => {
                console.error('Error saving message:', err);
            });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('User disconnected');
        });
    });
}

module.exports.router = router;
module.exports.initializeSocket = initializeSocket;