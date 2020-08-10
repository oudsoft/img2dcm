//uploader.js
require('dotenv').config();
const util = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const exec = require('child_process').exec;

const currentDir = __dirname;
const parentDir = path.normalize(currentDir + '/..');
const usrUploadDir = parentDir + process.env.USRUPLOAD_DIR;

const upload = multer({ dest: usrUploadDir});
const DWLD = '/img/usr/upload';
/*
const imagemagickDir = 'E:/PROJECT/docker/web/ImageMagick-6.9.3/bin';
const img2dcmDir = 'C:/ProgramData/chocolatey/lib/dcmtk/tools/dcmtk-3.6.4-win64-dynamic/bin/img2dcm.exe -i BMP'
const storescuDir ='C:/ProgramData/chocolatey/lib/dcmtk/tools/dcmtk-3.6.4-win64-dynamic/bin/storescu.exe';
*/
const img2dcmDir = 'img2dcm -i BMP'
const storescuDir ='storescu';
const pacsHost = process.env.pacsHost //'192.168.1.35';
const pacsPort = process.env.pacsPort; //'4242';
const httpPort = process.env.httpPort; //'8042';

const logger = require('./logger');

const doCreateDir = function(pathToCreate) {
	//console.log('pathToCreate=> ' + pathToCreate);
	pathToCreate.split(path.sep).reduce((prevPath, folder) => {
		const currentPath = path.join(prevPath, folder, path.sep);
		//console.log('currentPath=> ' + currentPath);
		if (!fs.existsSync(currentPath)){
			fs.mkdirSync(currentPath);
			fs.chmodSync(currentPath, 0777);
		}
		return currentPath;
	}, '');
}

const deleteFolderRecursive = function(path) {
	if( fs.existsSync(path) ) {
		fs.readdirSync(path).forEach(function(file,index){
			var curPath = path + "/" + file;
			if(fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
}

const runcommand = function (command) {
	return new Promise(function(resolve, reject) {
		logger().info(new Date()  + " Command " + command);
		exec(command, (error, stdout, stderr) => {
			if(error === null) {
				logger().info(new Date()  + " Resolve " + `${stdout}`);
				resolve(`${stdout}`);
			} else {
				logger().error(new Date()  + " Reject " + `${stderr}`);
				reject(`${stderr}`);
			}
        });
	});
}

const parseStr = function (str) {
    var args = [].slice.call(arguments, 1),
        i = 0;
    return str.replace(/%s/g, () => args[i++]);
}

const genUniqueID = function () {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4();
}

const doConvert = function(filename, StudyID, tempFile, username) {
	return new Promise(function(resolve, reject) {
		var fullnames = filename.split('.');
		//var command = 'cd ' + imagemagickDir;
		var command = 'curl --user ' + process.env.pacsUP + ' http://' + pacsHost + ':' + httpPort + '/studies/' + StudyID
		//cb9ba222-0dbd3ba1-4586ad09-57b67cd0-c4163d55';
		//console.log('curl command >>', command);
		runcommand(command).then((stdout) => {
			let studyObj = JSON.parse(stdout);
			let mainTags = Object.keys(studyObj.MainDicomTags);
			let patientMainTags = Object.keys(studyObj.PatientMainDicomTags);

			command = '';
			let fileExt = fullnames[(fullnames.length - 1)].toLowerCase();
			if ((fileExt === 'jpg') || (fileExt === 'pdf')){
				command += 'convert -verbose -density 150 -trim ' + parentDir + '/public' + DWLD + '/' + filename;
				if (fullnames[1] === 'pdf'){
					command += '[0]'; //first page only
				}
				command += ' -define bmp:format=BMP3 -quality 100 -flatten -sharpen 0x1.0 ';
				command += ' ' + parentDir + '/public' + DWLD + '/' + fullnames[0] + '.bmp';
				command += ' && cd ' + parentDir + '/public' + DWLD;
				command += ' && ' + img2dcmDir + ' ' + fullnames[0] + '.bmp' + ' ' + fullnames[0] + '.dcm';
				mainTags.forEach((tag, i) => {
					command += parseStr(' -k "%s=%s"', tag, Object.values(studyObj.MainDicomTags)[i]);
				});
				patientMainTags.forEach((tag, i) => {
					if (tag !== 'OtherPatientIDs')	{
						command += parseStr(' -k "%s=%s"', tag, Object.values(studyObj.PatientMainDicomTags)[i]);
					}
				});

				//command += ' -k "Modality=OT" -v';
				command += ' -k "Modality=CT" -v';

				command += ' && ' + storescuDir;
				command += parseStr(' %s %s', pacsHost, pacsPort);
				command +=  ' ' + fullnames[0] + '.dcm';
				command +=  ' -v';
				command += ' && ' + parseStr(' rm %s', tempFile);
				command += ' && ' + parseStr(' rm %s', fullnames[0] + '.bmp');
				command += ' && ' + parseStr(' rm %s', filename);
				command += ' && ' + parseStr(' rm %s', fullnames[0] + '.dcm');

				//console.log('command >>', command);

				runcommand(command).then((stdout) => {
					console.log('stdout >>', stdout);
					//res.status(200).send({status: {code: 200, text: 'ok baby.'}});
					logger().info(new Date()  + " Convert Success " + username + ":" + filename + ":" + StudyID);
					resolve({status: {code: 200, text: 'ok baby.'}});
				}).catch((err) => {
					console.log('err: 500 >>', err);
					//res.status(500).send({status: {code: 500, text: 'Internal Error\n' + err}});
					logger().error(new Date()  + " Convert Fail " + username + ":" + filename + ":" + StudyID);
					reject({status: {code: 500, text: 'Internal Error\n' + err}});
				});
			} else {
				console.log('stdout >>', fileExt + ' not support.');
				//res.status(501).send({status: {code: 501, text: 'img2dcm cann\'n support .' + extname + ' extension file.'}});
				logger().error(new Date()  + " File type Error " + username + ":" + filename + ":" + StudyID);
				reject({status: {code: 501, text: 'img2dcm cann\'t support .' + fileExt + ' extension file.'}});
			}
		});
	});
}

const doCallStudy = function(studyReq) {
	return new Promise(function(resolve, reject) {
		var command = 'curl --user ' + process.env.pacsUP + ' http://' + pacsHost + ':' + httpPort + '/studies/' + studyReq;
		runcommand(command).then((stdout) => {
			if (stdout) {
				let studyObj = JSON.parse(stdout);
				//res.status(200).send({status: {code: 200}, studies: studyObj});
				resolve({status: {code: 200}, studies: studyObj});
			} else {
				//res.status(200).send({status: {code: 401, description: 'Not found study ID = ' + studyReq}});
				resolve({status: {code: 401, description: 'Not found study ID = ' + studyReq}});
			}
		});
	});
}

module.exports = function (app, obj) {

	const auth = require('./auth.js')(app, obj);

	app.get('/createroomupload/(:roomname)', function(req, res) {
		//console.log('usrUploadDir=> ' + usrUploadDir);
		const roomname = req.params.roomname;
		const roomDir = parentDir + process.env.USRUPLOAD_DIR + '/' + roomname;
		fs.exists(roomDir, function(exists) {
		    if (!exists) {
				doCreateRoomUploadDir(roomname);
		    }
		});
		res.status(200).send('OK Boy.');	
	});

	app.get('/removeroomupload/(:roomname)', function(req, res) {
		//console.log('usrUploadDir=> ' + usrUploadDir);
		const roomname = req.params.roomname;
		const roomDir = parentDir + process.env.USRUPLOAD_DIR + '/' + roomname;
		fs.exists(roomDir, function(exists) {
		    if (exists) {
				doDeleteRoomUploadDir(roomname);
		    }
		});
		res.status(200).send('OK Boy.');	
	});

	app.get('/patients', function(req, res) {
		let token = req.headers.authorization;
		console.log('patients token >> ', token);
		if (token){
			auth.doDecodeToken(token).then((ur) => {
				console.log('patients ur >> ', ur);
				if (ur.length > 0){
					var command = 'curl --user ' + process.env.pacsUP + ' http://' + pacsHost + ':' + httpPort + '/patients';
					runcommand(command).then((stdout) => {
						let patientsArr = JSON.parse(stdout);
						var promiseList = new Promise(function(resolve, reject){
							let patients = [];
							patientsArr.forEach(async (item) => {
								command = 'curl --user ' + process.env.pacsUP + ' http://' + pacsHost + ':' + httpPort + '/patients/' + item;
								let out = await runcommand(command);
								let patientsObj = JSON.parse(out);
								patients.push(patientsObj);
							});
							setTimeout(()=>{
								resolve(patients);
							}, 1000);
						});
						Promise.all([promiseList]).then(async (ob)=>{
							logger().info(new Date()  + " Get Patients Success " + ur[0].email + ":" + JSON.stringify(ob[0]));
							res.status(200).send({status: {code: 200}, patients: ob[0]});
						});
					});
				} else {
					logger().info(new Date()  + " Get Patients Fail 300 not authentication");
					res.status(200).send({status: {code: 300, text: 'authentication fail'}});
				}
			});
		} else {
			logger().info(new Date()  + " Get Patients Fail 400 not authentication");
			res.status(200).send({status: {code: 400, text: 'This service not allow access with none token.'}});
		}
	});

	app.post('/patients', function(req, res) {
		let token = req.headers.authorization;
		auth.doDecodeToken(token).then((ur) => {
			console.log('ur>>', ur);
			res.status(200).send({status: {code: 200}, headers: req.headers});

		});
	});

	app.get('/studies/(:studyID)', function(req, res) {
		var studyReq = req.params.studyID;
		doCallStudy(studyReq).then((obj) => {
			res.status(200).send(obj);
		});
	});

	app.post('/converter', upload.array('filename'), function(req, res) {
		let token = req.headers.authorization;
		console.log('converter token >> ', token);
		if (token){
			auth.doDecodeToken(token).then((ur) => {
				console.log('converter ur >> ', ur);
				if (ur.length > 0){
					const rootname = req.originalUrl.split('/')[1];	
					const studiesID = req.body.StudyID;
					doCallStudy(studiesID).then((obj) => {
						if (obj.status.code == 200){
							var filename = req.files[0].originalname;

							var imgPath = req.files[0].destination + '/' + req.files[0].filename;
							var newPath = req.files[0].destination + '/'  + req.files[0].originalname;
							var readStream = fs.createReadStream(imgPath);
							var writeStream = fs.createWriteStream(newPath);
							readStream.pipe(writeStream);

							var link = 'http://' + req.headers.host + '/' + rootname + '/res' + DWLD + '/' + filename.split('.')[0] + '.dcm';

							var tempFile = req.files[0].filename;
							doConvert(filename, studiesID, tempFile, ur[0].email).then((resp) => {
								res.status(200).send(resp);
							}).catch((err) => {
								res.status(500).send(resp);
							});
						} else {
							res.status(500).send(obj);
						}
					});
				} else {
					res.status(200).send({status: {code: 300, text: 'authentication fail'}});
				}
			});
		} else {
			res.status(200).send({status: {code: 400, text: 'This service not allow access with none token.'}});
		}
	});

	app.post('/uploadinputfile', upload.array('filename'), function(req, res) {
		const token = req.cookies[process.env.COOKIE_NAME].token;
		//console.log('token from cookie', token);

		const rootname = req.originalUrl.split('/')[1];	

		var filename = req.files[0].originalname;
		var fullnames = filename.split('.');

		var imgPath = req.files[0].destination + '/' + req.files[0].filename;
		var newPath = req.files[0].destination + '/'  + req.files[0].originalname;
		var readStream = fs.createReadStream(imgPath);
		var writeStream = fs.createWriteStream(newPath);
		readStream.pipe(writeStream);
		var link = 'http://' + req.headers.host + '/' + rootname + '/res' + DWLD + '/' + filename;
		res.status(200).send({status: {code: 200, text: 'ok baby.', link: link, tempFile: req.files[0].filename}});
	});

	app.post('/store', function(req, res) {
		let token = req.headers.authorization;
		auth.doDecodeToken(token).then((ur) => {
			console.log('store ur >> ', ur);
			if (ur.length > 0){
				const studyID = req.body.StudyID;
				doCallStudy(studyID).then((obj) => {
					//console.log('study>>', obj);
					if (obj.status.code == 200){
						let filename = req.body.InputFileName;
						var tempFile = req.body.TempFile;
						doConvert(filename, studyID, tempFile, ur[0].email).then((resp) => {
							res.status(200).send(resp);
						}).catch((err) => {
							console.log('err>>', err);
							res.status(500).send(err);
						});
					} else {
						console.log('kkkk>>');
						res.status(500).send(obj);
					}
				});
			} else {
				res.status(200).send({status: {code: 300, text: 'authentication fail'}});
			}
		});
	});

	return {
		runcommand,
		parseStr
	}
}
