var express = require('express');
var router = express.Router();
var jsforce = require('jsforce');

/* GET home page. */
router.get('/', function (req, res, next) {
	console.log('req.cookies:', req.cookies);
	//get cookies
	if (req.cookies.url !== null && req.cookies.token !== null) {
		//校验登录信息是否过期
		var conn = new jsforce.Connection({
			accessToken: req.cookies.token,
			instanceUrl: req.cookies.url
		});

		conn.identity((err, identityRes) => {
			console.log('err:', err);
			console.log('res:', identityRes);
			if (err) {
				res.redirect('login');
			} else {
				res.render('index', { title: 'SalesForce' });
			}
		});
	}else{
		res.redirect('login');
	}
});

module.exports = router;
