// openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
// npm install -g express
// node server.js &

const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();

const options = {
  key: fs.readFileSync('.server/key.pem'),
  cert: fs.readFileSync('.server/cert.pem')
};

app.use(express.static('./'));

https.createServer(options, app).listen(8888);

