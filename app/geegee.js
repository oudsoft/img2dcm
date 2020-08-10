//geegee.js

const fs = require('fs');
const util = require("util");
const path = require('path');
const url = require('url');
const express = require('express');
const app = express();
app.use(express.static('public'));

const GEEGEE_PATH = '/mnt/e/Final Release/Revise';
//const GEEGEE_PATH = 'C:/Users/Oodsoft/Desktop/Picture'
//const GEEGEE_PATH = 'E:/Final Release/Revise';
//const GEEGEE_PATH = '/var/www/html/myggee';
//const GEEGEE_PATH = '/home/oudsoft/temp';
//const GEEGEE_PATH = '/home/blueseas/workshop/node/slideshow/public/pic1';
const geegeePath = path.normalize(GEEGEE_PATH);

app.get('/geegeeitems', function(req, res) {
	fs.readdir(geegeePath, (err, dirs) => {
		/*
	  files.forEach(file => {
	    console.log(colors.green(`${file}`));
	  });
	  */
	  res.status(200).send(dirs);
	});
})

app.get('/geegeelistdirs/(:dir)', function(req, res) {
	const dir = req.params.dir;
	let geegeeDirPath = geegeePath + '/' + dir;
	//console.log(geegeeDirPath);
	fs.readdir(geegeeDirPath, (err, files) => {
	  res.status(200).send(files);
	});
});

app.get('/geegeelistfiles/(:gname)/(:gdir)', function(req, res) {
	const gname = req.params.gname;
	const gdir = req.params.gdir;
	let geegeeFullDirPath = geegeePath + '/' + gname + '/' + gdir;
	//console.log(geegeeFullDirPath);
	fs.readdir(geegeeFullDirPath, (err, files) => {
	  res.status(200).send(files);
	});
});

app.get('/geegeefile/(:gname)/(:gdir)/(:gfile)', function(req, res) {
	const gname = req.params.gname;
	const gdir = req.params.gdir;
	const gfile = req.params.gfile;
	let geegeeFullDirPath = geegeePath + '/' + gname + '/' + gdir + '/' + gfile;
	//console.log(geegeeFullDirPath);
	fs.readFile(geegeeFullDirPath, (err, file) => {
		if (!err){
			res.writeHead(200, {'Content-Type': 'image/jpeg'});
			res.end(file);
		} else {
			console.log(err);
		}
	});
});

module.exports = app;
