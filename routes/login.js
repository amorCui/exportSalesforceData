var express = require('express');
var router = express.Router();
var jsforce = require('jsforce');

/* GET login page. */
router.get('/', function(req, res, next) {
    res.render('login', { title: 'SalesForce' });
});

/* POST login listing. */
router.post('/postdata', function(req, res, next) {
    console.log('into postdata');
    var url = req.body.url;
    var username = req.body.username;
    var pwd = req.body.token === undefined?req.body.pw:req.body.pw + req.body.token;


    console.log('url:',url);
    console.log('username:',username);
    console.log('pwd:',pwd);
    //check url if have https://
    if(url.indexOf('https://') < 0){
        url = 'https://' + url;
    }
    var options = {
        loginUrl:url
    }
    var conn = new jsforce.Connection(options);
   
    var userinfo = conn.login(username,pwd,function(err,loginRes){
        var result = {

        };
        if(err !== null){
            console.log('err:',err.message);
            result.rst = false;
            result.error = err.message;
        }else{
            //登录成功之后
            console.log('conn:',conn);
            console.log('sessionId:',conn.sessionId);
            var accessToken = conn.accessToken;
            var cookies = {
                url:conn.instanceUrl,
                accessToken:conn.accessToken
            }
            result.rst = true;
            result.cookie = cookies;
            // res.cookie('salesforceAccessToken',cookies,{maxAge: 10 * 60 * 1000});
            // console.log('req.cookie:',req.cookie);
        }
        res.send(result);
    });

});


module.exports = router;