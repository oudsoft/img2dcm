//server.js
require('dotenv').config();
const os = require('os');
const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();

const parentDir = require('path').resolve(__dirname, '..');

const serverPort = process.env.SERVER_PORT;//3000;

const httpServer = http.createServer(app).listen(serverPort);

const mainInstant = {};
const mainApp = require('./app/mainApp.js')(mainInstant);
console.log(serverPort);
console.log(parentDir);
mainApp.use('/res', express.static(parentDir + process.env.SRC_SUBDIR + '/public'));

app.use('/img2dcm', mainApp);