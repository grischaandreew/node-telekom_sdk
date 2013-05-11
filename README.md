telekom_sdk
===========

implementation of Telekom REST API in nodejs.


Install
=======

To install the most recent release from npm, run:

    npm install telekom_sdk

To install the latest from the repository, run:

    npm install path/to/telekom_sdk


Introduction
============

```javascript
var telekom_service_client = require("telekom_sdk");

var c = new telekom_service_client("sandbox")
	.authorize("username","password", function(err,client){
		if(err) console.error(err);
		else {
			c.sendSms({
				number: "+0000011",
				message: "test message from node.js",
			  originator: 'nodejs client',
			}, function(err, success){
				if(err){
					console.log(err);
				} else {
					console.log(success);
					c.quota({
						moduleID: "SmsSandbox"
					}, function(err, success){
						console.log(err);
						console.log(util.inspect(success,false,null,true));
					});
				}			
			});
		}
	});
```


GitHub information
==================

The source code is available at https://github.com/grischaandreew/node-telekom_sdk
You can either clone the repository or download a tarball of the latest release.