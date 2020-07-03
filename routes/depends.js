let webdriver = require('selenium-webdriver');
let chrome = require('selenium-webdriver/chrome');
let chromedriver = require('chromedriver');

let csv = require('csv-parser');
let fs = require('fs');
let path = require('path');

let jsforce = require('jsforce');

let {Builder, By, Options, Key, until} = require('selenium-webdriver');
let express = require('express');
let router = express.Router();

let multer  = require('multer');
let { v4: uuidv4 } = require('uuid');

chrome.setDefaultService(new chrome.ServiceBuilder(chromedriver.path).build());

//设置保存规则
let storage = multer.diskStorage({
    //destination：字段设置上传路径，可以为函数
    destination: path.resolve(__dirname, '../upload'),

    //filename：设置文件保存的文件名
    filename: function(req, file, cb) {
        let index = file.originalname.lastIndexOf('.');
        let extName = file.originalname.slice(index);
        let fileName = file.originalname.slice(0, index);
        let uuid = uuidv4();
        cb(null, fileName + '_' + uuid + extName);
    }
})
//设置限制（可选）
let imageLimit = {
    fieldSize: '2MB'
}
//创建 multer 实例
let uploader = multer({ 
    storage: storage,
    limits: imageLimit
}).single('file'); 



/* GET depends page. */
router.get('/', function(req, res, next) {
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
				res.render('depends', { title: 'depends' });
			}
		});
    }else{
		res.redirect('login');
	}
});

/* GET force listing. */
router.post('/check' ,  async function(req, res, next) {
    console.log('call check function');
    
    uploader(req, res, function (err) {
        if (err instanceof multer.MulterError) {
          // A Multer error occurred when uploading.
          console.log('multer.MulterError:', err);
        } else if (err) {
          // An unknown error occurred when uploading.
          console.log('err:', err);
        }
        console.log('req.file:', req.file);
        //read file
        let readResults = [];
        fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => readResults.push(data))
        .on('end', async () => {
            console.log('result:',readResults);
            let lstRst = await check(req, readResults);
            createFile(lstRst);
        });
        // Everything went fine.
      })

    
    // let lstRst = await check(req, lstData);
    // createFile(lstRst);
});

   



async function check(req, lstData) {
    console.log('into check!!!');
    // let lstData = [
    //     ['Account', 'PEP_ExternalID_Account__c'],
    //     ['AccountToRoute__c', 'PEP_ExternalID_AccountToRoute__c']
    // ];

    let lstRst = [];

    let lstSObjectField = [];
    for(var data of lstData){
        let sObjectField = await getFieldId(req, data.Object, data.Field);
        lstSObjectField.push(sObjectField);
    }
    
    console.log('lstSObjectField:', lstSObjectField);

    let driver = await initDriverLogin(req.cookies);

    for(var  sObjectField of lstSObjectField){
        var lstReferenceObject = await getDependsByIds(driver, sObjectField);
        lstRst = lstRst.concat(lstReferenceObject);
    }
    
    if(driver){
        driver.close();
    }

    return lstRst;
}

function createFile(lstRst){
    const exportFilePath = path.join(__dirname, '../output/depends/' + Date.now() + '.csv');
    let fd;
    try{
        console.log('开始写入文件');
        let fileHead = 'object,field,referenceType,referenceLabel\n';
        fs.appendFileSync(exportFilePath, fileHead ,'utf8');
        let fileContent;
        for(var rst of lstRst){
            fileContent = rst.ObjectName + ',' + rst.FieldName + ',' + rst.referenceType + ',' + rst.referenceLabel + '\n';
            fs.appendFileSync(exportFilePath, fileContent ,'utf8');
        }
        console.log(`写入成功,文件路径为${exportFilePath}`);
    }catch(e){
        console.log('exception in create depends file:', e);
    }finally{
        if(fd != undefined){
            fs.closeSync(fd);
        }
    }
}

/**
 * get object id and field id by name 
 * @param {*} req req
 * @param {*} objName object name in salesforce 
 * @param {*} fieldName  field name in salesfroce
 */
function getFieldId(req, objName, fieldName){
    // let objName = 'Account';
    // let fieldName = 'ACPT_DFLT_CHK_IN_FLG__c';
    return new Promise((resolve, reject) =>{
        let conn ;
        console.log('req.cookies:',req.cookies);

        try{
            conn = new jsforce.Connection({
                accessToken : req.cookies.token,
                instanceUrl : req.cookies.url
            });
        }catch(e){
            console.log('Exception:', e);
            reject(`Exception:${e}`);
        }

        //通过正则表达式去掉__c
        let fieldDevName = fieldName;
        let myRe = /(\w+)__c/g;
        if(fieldDevName.length > 3 && myRe.exec(fieldDevName)){
            fieldDevName = fieldDevName.substr(0, fieldDevName.length - 3);
        }
        let soql = "SELECT ID, DeveloperName,EntityDefinition.DeveloperName,EntityDefinitionId " +
                    "FROM Customfield " +
                    "where DeveloperName = '" + fieldDevName +  "' " +
                    "and EntityDefinition.QualifiedApiName = '" + objName + "'";
        //use tooling api to get Customfield message
        conn.tooling.query(soql, function(err, queryRes) {
            console.log('soql:',soql);
            // console.log('queryRes:',queryRes);
            if (err) { 
                console.log('err:', err);
                reject(`Exception:${err}`);
            }
            let records = queryRes.records;

            var sObjectField = {
                Id : records[0].Id,
                Name : fieldName,
                Type : objName,
                TypeId : records[0].EntityDefinitionId,
                Denpends: []
            };
            resolve(sObjectField);
        });
    });
    
}

async function initDriverLogin(connectionCookies){
    let driver ;
    const url = connectionCookies.url + '/secur/frontdoor.jsp?sid=' + connectionCookies.token;
    try{
        const capabilities = {
            'chromeOptions': {
                'args': ['useAutomationExtension', 'false']
            }
        }
        driver = new Builder()
                .withCapabilities(capabilities)
                .forBrowser('chrome')
                .build();

        let options = driver.getCapabilities();
        console.log('options:', options);
        await driver.get(url);
        // console.log('driver in initDriverLogin:', driver);
    }catch(e){
        console.log('Exception in initDriverLogin:',e);
    }
    return driver;
}

async function getDependsByIds(driver, sObjectField){
    let lstReferenceObject = [];
    try{
        let rowItemSize = 2000;
        let domain = 'https://pepsico-latam--tostidev.cs22.my.salesforce.com/';
        let objectId = sObjectField.TypeId.substr(0, 15);
        let fieldId = sObjectField.Id.substr(0, 15);
        let dependsUrl = domain + 'p/setup/field/CustomFieldDependencyUi/d?id=' + fieldId + '&type=' + objectId + '&rowsperlist=' + rowItemSize;
   
        await driver.get(dependsUrl);
        var listDataRow = await driver.findElements(By.css('.listRelatedObject table.list tr.dataRow'));

        for(var dataRow of listDataRow){
            let referenceType = await dataRow.findElement(By.css('th')).getText();
 
            let referenceLabel = await dataRow.findElement(By.css('.dataCell>a')).getText();
            
            let referenceObject = {
                ObjectName: sObjectField.Type,
                FieldName: sObjectField.Name,
                referenceType: referenceType,
                referenceLabel: referenceLabel,
            };
            lstReferenceObject.push(referenceObject);
            // console.log('lstReferenceObject:', lstReferenceObject);
        }
    }catch(e){
        console.log('Exception in getDependsByIds:',e);
    }
    return lstReferenceObject;
}


module.exports = router;