'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  appId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [2, 'Username must be at least 2 characters'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [4, 'Password must be at least 4 characters'],
    select: false,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'user'],
    default: 'user',
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended'],
    default: 'active',
  },
  createdAt: {
    type: Number,
    default: () => Date.now(),
  },
  updatedAt: {
    type: Number,
    default: () => Date.now(),
  },
}, { timestamps: false });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Strip password from output
userSchema.methods.toSafeObject = function () {
  return {
    id: this.appId,
    name: this.name,
    username: this.username,
    role: this.role,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
