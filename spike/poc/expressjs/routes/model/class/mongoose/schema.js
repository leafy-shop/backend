const { default: mongoose } = require("./../../../../config/mongoose_config");

const { Schema } = mongoose;

const chatLogSchema = new Schema({
  roomId: String,
  messageId: Number,
  sender: String,
  reciever: String,
  message: String,
  time: { type: Date, default: Date.now }
});

const chatRoomSchema = new Schema({
  roomId: String,
  customer: String,
  supplier: String,
  time: { type: Date, default: Date.now }
});


const chat = mongoose.model('chatLog', chatLogSchema);
const chatRoom = mongoose.model('chatRoom', chatRoomSchema)

module.exports.chat = chat
module.exports.chatRoom = chatRoom