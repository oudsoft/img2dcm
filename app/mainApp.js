//mainApp.js

require('dotenv').config();
const os = require('os');
const fs = require('fs');
const path = require("path");
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mainApp = express();


module.exports = ( coreObj ) => { 

	const parentDir = require('path').resolve(__dirname, '..');

	//mainApp.use(bodyParser.urlencoded({ extended: true }));
	mainApp.use(bodyParser.json({ limit: "50MB", type:'application/json', extended: true}));
	mainApp.use(bodyParser.urlencoded({limit: '50MB', type:'application/x-www-form-urlencoded', extended: true}));
	mainApp.use(cookieParser());

	const geegee = require('./geegee.js');
	mainApp.use('/geegee', geegee);

	const uploader = require('./uploader.js')(mainApp, coreObj);
	const auth = require('./auth.js')(mainApp, coreObj);

	mainApp.get('/', function(req, res) {
		console.log('req.headers >>', req.headers);
		const hostname = req.headers.host;
		console.log(hostname);
		const rootname = req.originalUrl.split('/')[1];
		console.log(rootname);
		res.redirect('/' + rootname + '/res/index.html');
		//res.status(200).send('Hello World.');
	});

	mainApp.post('/test', function(req, res) {
		console.log('req.headers >>', req.headers);
		console.log('req.body >>', req.body);
		const hostname = req.headers.host;
		const rootname = req.originalUrl.split('/')[1];
		res.status(200).send({status: {code: 200, text: 'ok boy.'}});
	});

	return mainApp; 	
}