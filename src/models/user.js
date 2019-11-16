
const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    hash: String,
    salt: String
});

UserSchema.methods.setPassword = function (password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt,
        1000, 64, 'sha512').toString(`hex`);
};

UserSchema.methods.isPasswordValid = function (password) {
    const hash = crypto.pbkdf2Sync(password,
        this.salt, 1000, 64, `sha512`).toString(`hex`);
    return this.hash === hash;
};
UserSchema.methods.getFiltered = function () {
    delete this._doc.hash;
    delete this._doc.salt;
    delete this._doc.__v;
    return this
};

const User = module.exports = mongoose.model('Users', UserSchema); 
