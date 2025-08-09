const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  skills: [String],
  profilePic: { type: String, default: '' }, // We will use this from now on!
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
