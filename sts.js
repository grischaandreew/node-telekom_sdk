var https = require('https');
		util  = require('util'),
		url_parse = require('url').parse;

function client( username, password, callback ){
	this.resturl = "https://sts.idm.telekom.com/rest-v1/tokens/odg";
	
	var urlparse = url_parse(this.resturl);
	
	var req = https.request({
		host: urlparse.host,
		port: urlparse.port,
		path: urlparse.path,
		method: 'GET',
		headers: {
			'Authorization': 'Basic ' +  new Buffer(username + ":" + password).toString('base64'),
			'Content-Type': 'application/json'
		}
	}, function(res) {
		var body = "";
		res.on('data', function (data) {
			body += data;
		});
		
		res.on('end', function() {
			if( res.statusCode != 200 ) {
				return callback( new Error( "not a valid http status code: " + res.statusCode ), null );
			}
			try {
				body = JSON.parse(body);
				if( !body.token ){
					return callback( new Error( "not a valid token" ), null );
				}
				return callback( null, new token( body.token, res.headers.expires ) );
			} catch(err){
				return callback( err, null );
			}
		});
	});
	req.on('error', function(err) {
		callback(err,null);
	});
	req.end();
}


function token( token, expire ){
	if( !util.isDate(expire) ) {
		var parsed = Date.parse(expire);
		expire = new Date();
		expire.setTime(parsed);
	}
	
	var that = this;
	
	this.token = token;
	
	this.expire = expire;
	
	this.getToken = function(){
		return token;
	};
	
	this.getValidUntil = function(){
		return expire;
	};
	
	this.getExpired = function(){
		return (new Date) > expire;
	};

};

exports = module.exports = {
	client: client,
	token: token
};