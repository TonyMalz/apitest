const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');

let database = null;
let mongoDBURL = null;

async function connectDB() {
    const mongo = new MongoMemoryServer();
    mongoDBURL = await mongo.getConnectionString();
    const connection = await MongoClient.connect(mongoDBURL, { useNewUrlParser: true });
    database = connection.db();
}

async function getDatabase() {
    if (!database) await connectDB();
    return database;
}

function getMongoUrl() {
    return mongoDBURL
}

module.exports = {
    getDatabase,
    connectDB,
    getMongoUrl
};