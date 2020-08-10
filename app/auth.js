//auth.js
require('dotenv').config();
const jwt = require("jwt-simple");
const bodyParser = require("body-parser");
const { Pool, Client } = require('pg');
const logger = require('./logger');

const pool = new Pool({
	user: process.env.PGUSER,
	host: process.env.PGHOST,
	database: process.env.PGDATABASE,
	password: process.env.PGPASSWORD,
	port: process.env.PGPORT,
});

function doVerifyUser(username, password){
	return new Promise(function(resolve, reject) {
		pool.connect().then(client => {
			client.query('BEGIN');
			var sqlCmd = "select userid, email from users where (email=$1) and (password=md5($2))";
			client.query(sqlCmd, [username, password]).then(res => {
				if (res.rowCount > 0){
					client.query('COMMIT');
					resolve(res.rows);
				} else {
					resolve({}); //<-- //should modify resolve etc. null/undefined for blank user
				}
			}).catch(err => {
				client.query('ROLLBACK');
				reject(err.stack)
			});
			client.release();
		});
	});
}

function doDecodeToken(token) {
	return new Promise(function(resolve, reject) {
		const payloadDecode = jwt.decode(token, process.env.SECRET_KAY);
		pool.connect().then(client => {
			client.query('BEGIN');
			var sqlCmd = "select userid, email from users where (email=$1)";
			client.query(sqlCmd, [payloadDecode.sub]).then(res => {
				if (res.rowCount > 0){
					client.query('COMMIT');
					resolve(res.rows);
				} else {
					resolve([]); //<-- //should modify resolve etc. null/undefined for blank user
				}
			}).catch(err => {
				client.query('ROLLBACK');
				reject(err.stack)
			});
			client.release();
		});
	});
}

function doRegisterUser(username, password, type){
	return new Promise(function(resolve, reject) {
		pool.connect().then(client => {
			client.query('BEGIN');
			var sqlCmd = "insert into users (email, password, type, createat, updateat) values ($1, md5($2), $3, now(), now()) RETURNING userid";
			client.query(sqlCmd, [username, password, type]).then(res => {
				if (res.rowCount > 0){
					client.query('COMMIT');
					resolve(res.rows);
				} else {
					resolve([]); //<-- //should modify resolve etc. null/undefined for blank user
				}
			}).catch(err => {
				client.query('ROLLBACK');
				reject(err.stack)
			});
			client.release();
		});
	});
}

function doCheckDuplicateEmail(email){
	return new Promise(function(resolve, reject) {
		pool.connect().then(client => {
			client.query('BEGIN');
			var sqlCmd = "select userid, email from users where email=$1";
			client.query(sqlCmd, [email]).then(res => {
				if (res.rowCount > 0){
					client.query('COMMIT');
					resolve(res.rows);
				} else {
					resolve([]); //<-- //should modify resolve etc. null/undefined for blank user
				}
			}).catch(err => {
				client.query('ROLLBACK');
				reject(err.stack)
			});
			client.release();
		});
	});
}

module.exports = function (app, obj) {
	app.post('/genauthtokenkey', function(req, res) {
		const payload = {
			sub: req.body.username,
			iat: new Date().getTime(), //มาจากคำว่า issued at time (สร้างเมื่อ)
			hostname: req.headers.host,
			rootname: req.originalUrl.split('/')[1]
		};
		console.log(payload);
		const payloadEncode = jwt.encode(payload, process.env.SECRET_KAY);

		/*
		console.log(payloadEncode);
		req.headers.authorization = payloadEncode;
		*/
		/*
		res.clearCookie('jwt');
		res.cookie('jwt', payloadEncode);
		*/
		/*
		const payloadDecode = jwt.decode(payloadEncode, process.env.SECRET_KAY);
		console.log(payloadDecode);
		*/
		res.status(200).send({status: {code: 200}, token: payloadEncode});
	});

	app.post('/testauth', function(req, res) {
		let token = req.headers.authorization;
		let rootname = req.originalUrl.split('/')[1];
		let loginurl = '/' + rootname + '/res/login.html';
		if (token !== 'null') {
			doDecodeToken(token).then((ur) => {
				console.log('testauth ur >>', ur);			
				if (ur.length > 0){
					res.status(200).send({status: {code: 200}});
				} else {
					res.status(200).send({status: {code: 301}, url: loginurl});
				}
			});
		} else {
			logger().info(new Date()  + " Error  testauth Fail with blank authorization header.");
			res.status(200).send({status: {code: 302}, url: loginurl});
		}
	});

	app.post('/login', (req, res) => {
		const hostname = req.headers.host;
		const rootname = req.originalUrl.split('/')[1];
		let username = req.body.username;
		let password = req.body.password;
		doVerifyUser(username, password).then((user) => {
			console.log('user >> ', user);
			if (user.length === 0) {
				logger().info(new Date()  + " Info " + username + ":" + password + " Login Fail.");
				res.redirect('/' + rootname + '/res/login.html?c=1');
			} else {
				const payload = {
					sub: user[0].email,
					iat: new Date().getTime(), //มาจากคำว่า issued at time (สร้างเมื่อ)
					hostname: req.headers.host,
					rootname: req.originalUrl.split('/')[1]
				};

				const payloadEncode = jwt.encode(payload, process.env.SECRET_KAY);

				res.clearCookie(process.env.COOKIE_NAME);
				res.cookie(process.env.COOKIE_NAME, {token: payloadEncode});

				logger().info(new Date()  + " Info " + user[0].email + " Login Success.");

				url = '/' + rootname + '/res/index.html';
				res.status(200).send({status: {code: 200}, url: url, token: payloadEncode});
			}
		});
	});

	app.post('/emailduplicate', (req, res) => {
		let email = req.body.email;
		doCheckDuplicateEmail(email).then((ur) => {
			res.status(200).send({status: {code: 200}, ur: ur});			
		});
	});

	app.post('/register', (req, res) => {
		let username = req.body.email;
		let password = req.body.password;
		doRegisterUser(username, password, 'normal').then((ur) => {
			logger().info(new Date()  + " Info " + username + " Register Success.");
			res.status(200).send({status: {code: 200}, ur: ur});			
		});
	});

	return {
		doVerifyUser,
		doDecodeToken
	}
}
