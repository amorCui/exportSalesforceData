var express = require('express');
var router = express.Router();
var jsforce = require('jsforce');
var jsonexport = require('jsonexport');
var fs = require('fs');
var XLSX = require('xlsx')
var path = require('path');


var limit = 2000;

/* GET force listing. */
router.get('/', function(req, res, next) {
	res.render('force');
});

/* GET force listing. */
router.post('/query', function(req, res, next) {
	var soql = decodeURI(req.body.soql);//get cookies
	if(req.cookies.url && req.cookies.token){
		console.log('req.cookies.token：',req.cookies.token);
		console.log('req.cookies.url',req.cookies.url);


		var conn = new jsforce.Connection({
			accessToken : req.cookies.token,
			instanceUrl : req.cookies.url
		});

		conn.query(soql, function(err, queryRes) {
			console.log('soql:',soql);
			console.log('queryRes:',queryRes);
			if (err) { 
				console.log('err:',err);
				return handleError(err); 
			}
			josnToCsvFile(queryRes.records);
			res.json(queryRes.records);
		});
	}
	
});



function josnToCsvFile(record){
	console.log('开始写入文件');
	var filePath = path.join(__dirname, '../output/query/' + Date.now() + '.csv');
	console.log('filePath',filePath);

	// open the file in writing mode, adding a callback function where we do the actual writing
	jsonexport(record,function(err, csv){
		if(err) return console.log(err);
		fs.writeFile(filePath, csv ,'utf8',function(error){
			if(error){
				console.log(error);
				return false;
			}
			console.log('写入成功');
		});
	});

}


module.exports = router;
