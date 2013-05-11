var sts = require("./sts.js"),
	https = require('https'),
	util  = require('util'),
	querystring = require('querystring'),
	url_parse = require('url').parse,
	fs = require('fs');

/**
 * Constructs a service client for the Telekom service Send SMS using username and password or a security token getter.
 *
 * @param String environment
 * 		The environment which should be used to access the service. Possible values are:
 * 		<ul>
 * 			<li>production</li>
 * 			<li>sandbox</li>
 * 			<li>mock</li>
 * 		</ul>
 */

function service_client( environment ) {
	var that = this,
			http_user_agent = "Telekom node.js BETA SDK/0.0.1",
			max_retries = 5,
			_username, _password;
	
	this.environment = environment || "production";
	
	/**
	 * Authorize a service client for the Telekom service using username and password or a security token getter.
	 *
	 * @param String|SecurityTokenGetter username
	 * 		Either the Telekom username.
	 * @param String password
	 * 		The Telekom password.
	 */
	this.authorize = function(username, password, callback){
		_username = username;
		_password = password;
		new sts.client( username, password, function(err,token){
			if(err) {
				callback(err, null);
			} else {
				that.token_getter = token;
				callback(null,that);
			}
		});
		return that;
	};
	
	this.request = function( url, method, params, callback, retry ){
		retry = retry || 0;
		if( !that.token_getter ){
			return callback(new Error("no token loaded"),null);
		} else if( that.token_getter.getExpired() ){
			if( retry < max_retries ) {
				return that.authorize( _username, _password, function(err,success){
					if(err) return callback(err,null);
					that.request(url, method, params, callback, retry + 1);
				} );
			} else {
				return callback(new Error("max retries on token loaded"),null);
			}
		}
		url = url.replace("<environment>", that.environment);
		method = String(method).toUpperCase();
		params = params || {};
		var urlparsed = url_parse(url);
		var query = "", bodyquery = "";
		if( method == "GET" ) {
			query = "?" + querystring.stringify(params)
		} else {
			bodyquery = querystring.stringify(params);
		}
		var req = https.request({
			host: urlparsed.host,
			hostname: urlparsed.hostname,
			
			port: urlparsed.port || 443,
			path: urlparsed.path + query,
			method: method,
			agent: false,
			
			headers: {
				'Authorization': 'TAuth realm="https://odg.t-online.de",tauth_token="' + that.token_getter.getToken() + '"',
				'User-Agent': http_user_agent,
				'Accept': 'application/json',
				'Host': urlparsed.host,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': bodyquery.length
			}
		}, function(res) {
			res.setEncoding('utf8');
			var body = "";
			res.on('data', function (data) {
				body += data;
			});
			res.on('end', function() {
				try {
					body = JSON.parse(body);
					if( res.statusCode != 200 ) {
						return callback( new Error( "not a valid http status code: " + res.statusCode ), body );
					}
					return callback( null, body );
				} catch(err){
					return callback( err, null );
				}
			});
		});
		
		req.on('error', function(err) {
			callback(err,null);
		});
		if( method != "GET" && bodyquery ){
			req.write(bodyquery);
		}
		
		req.end();
		return that;
	};
	
}

/**
 * Versand einer SMS / Versand einer Flash-SMS
 *
 * @param string opt.number Die Empfängerrufnummern, durch Kommas (",") getrennt. (Siehe unterstützte Rufnummernformate)
 * @param string opt.message Die an die Empfängerrufnummern zu sendende Mitteilung.
 * @param string opt.originator Der Absender, so wie er beim Empfänger angezeigt wird.Die Angabe einer Rufnummer als Absender ist nur dann erlaubt, wenn diese vorher validiert wurde. (Siehe: Send SMS - Rufnummernvalidierung)
 * @param string opt.flash Legt fest, ob die SMS als Flash-SMS gesendet werden soll:[true - SMS wird als Flash-SMS gesendet[anderer Wert - SMS wird als normale SMS gesendet]]
 * @param string opt.account Konto-ID des Unterkontos, über welches die Service-Nutzung abgerechnet werden soll. Wird der Parameter nicht angegeben, erfolgt die Abrechnung über das Hauptkonto.Siehe: Kontobasierte Servicenutzung
 * @return SendSmsResponse The result of the operation Versand einer SMS / Versand einer Flash-SMS
 */
service_client.prototype.sendSms = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-sms/rest/<environment>/sms';
	if(!opt.number) {
		return callback(new Error("no number"), null);
	}
	if(!opt.message) {
		return callback(new Error("no message"), null);
	}
	var params = {};
	params.number = util.isArray(opt.number) ? opt.number.join(",") : opt.number.toString();
	params.message = opt.message.toString();
	if(opt.originator) params.originator = opt.originator;
	if(opt.flash) params.flash = opt.flash;
	if(opt.account) params.account = opt.account;
	return this.request( url, "POST", params, callback );
};


/**
 * Versand einer Validierungs-SMS
 *
 * @param string opt.number Die zu validierende Rufnummer.
 * @param string opt.message Die begleitende Nachricht, die mit dem Validierungs-Code gesendet werden soll.Diese Nachricht muss zwei Platzhalter enthalten:[#key#[#validUntil#]]Eine Beispielmitteilung ist: "Das Keyword zur Validierung Ihrer Rufnummer bei example.com lautet #key# und ist #validUntil# gültig."Falls die Platzhalter nicht vorhanden sind, wird folgende Standardnachricht gesendet: "Ihr Validierungsschluessel ist #key#. Er ist gueltig bis #validUntil#."
 * @param string opt.originator Der Absender, so wie er beim Empfänger angezeigt wird.Der Absender kann aus maximal 11 Zeichen bestehen. Erlaubte Zeichen sind Buchstaben und Ziffern. Die alleinige Verwendung von Ziffern ist nicht erlaubt.
 * @param string opt.account Konto-ID des Unterkontos, über welches die Service-Nutzung abgerechnet werden soll. Wird der Parameter nicht angegeben, erfolgt die Abrechnung über das Hauptkonto.Siehe: Kontobasierte Servicenutzung
 * @return SendValidationKeywordResponse The result of the operation Versand einer Validierungs-SMS
 */
service_client.prototype.smsValidation = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-sms-validation/rest/<environment>/send';
	if(!opt.number) {
		return callback(new Error("no number"), null);
	}
	if(!opt.message) {
		return callback(new Error("no message"), null);
	}
	var params = {};
	params.number = util.isArray(opt.number) ? opt.number.join(",") : opt.number.toString();
	params.message = opt.message.toString();
	if(opt.originator) params.originator = opt.originator;
	if(opt.flash) params.flash = opt.flash;
	if(opt.account) params.account = opt.account;
	return this.request( url, "POST", params, callback );
};


/**
 * 
 * @param String opt.number The phone number to be validated.
 * @param string opt.key Der Validierungs-Code, der an die zu validierende Rufnummer geschickt wurde.Das Format des Codes ist alphanumerisch und sechsstellig, beispielsweise: A3B5DGDer Code wird nach der dritten Fehleingabe ungültig und die Rufnummer 10 Minuten lang für eine erneute Validierung gesperrt.Die Sperrung kann aufgehoben werden, wenn der Validierungsvorgang über die Methode invalidate abgebrochen und über sendValidationKeyword erneut gestartet wird.
 * @return ValidateResponse The result of the operation 
 */
service_client.prototype.smsValidationValidate = function( opt, callback ){
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-sms-validation/rest/<environment>/validatednumbers/';
	if(!opt.number) {
		return callback(new Error("no number"), null);
	}
	if(!opt.key) {
		return callback(new Error("no key"), null);
	}
	url += encodeURIComponent(opt.number);
	var params = {};
	params.key = opt.key.toString();
	return this.request( url, "POST", params, callback );
};


/**
 * 
 * @param String opt.number The phone number whose validation should be withdrawn or for which a validation process should be terminated.
 * @return InvalidateResponse The result of the operation 
 */
service_client.prototype.smsValidationInvalidate = function( opt, callback ){
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-sms-validation/rest/<environment>/validatednumbers/';
	if(!opt.number) {
		return callback(new Error("no number"), null);
	}
	url += encodeURIComponent(opt.number);
	var params = {};
	return this.request( url, "DELETE", params, callback );
};

/**
 * 
 * @param String opt.number The phone number whose validation should be withdrawn or for which a validation process should be terminated.
 * @return InvalidateResponse The result of the operation 
 */
service_client.prototype.smsValidationNumbers = function( opt, callback ){
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-sms-validation/rest/<environment>/validatednumbers';
	var params = {};
	return this.request( url, "GET", params, callback );
};


/**
 * Versand einer MMS
 *
 * @param string opt.number Die Empfängerrufnummern, durch Kommas (",") getrennt. (Siehe unterstützte Rufnummernformate)
 * @param string opt.subject Die Betreffzeile.
 * @param string opt.message Eine Textmeldung.Mindestens eines der Felder message und attachment muss vorhanden sein.
 * @param string opt.attachment Zu sendender Anhang.Der Versand beliebiger Anhänge (Bild, Ton, Video, Text) wird unterstützt. Der Datentyp des Anhangs muss über contentType angegeben werden. Darüber hinaus muss der Dateiname über filename angegeben werden.Mindestens eines der Felder message und attachment muss vorhanden sein.
 * @param string opt.filename Dateiname des Anhangs, falls ein Anhang gesendet werden soll.
 * @param string opt.contentType Dateityp des Anhangs, falls ein Anhang gesendet werden soll.Folgende Typen werden unterstützt:[text/plain[audio/x-wav[audio/x-midi[audio/x-mpeg[audio/x-pn-realaudio[image/gif[image/jpeg[image/png[image/tiff[image/vnd.wap.wbmp[video/3gpp]]]]]]]]]]]
 * @param string opt.originator Der Absender, so wie er beim Empfänger angezeigt wird.Erlaubt sind derzeit keine nur validierte Rufnummer oder keine AngabeDie Angabe einer Rufnummer als Absender ist nur dann erlaubt, wenn diese vorher validiert wurde. (Siehe: Send SMS - Rufnummernvalidierung)
 * @param string opt.account Konto-ID des Unterkontos, über welches die Service-Nutzung abgerechnet werden soll. Wird der Parameter nicht angegeben, erfolgt die Abrechnung über das Hauptkonto.Siehe: Kontobasierte Servicenutzung
 * @return SendMmsResponse The result of the operation Versand einer MMS
 */
service_client.prototype.sendMms = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-mms/rest/<environment>/sendMMS';
	if(!opt.number) {
		return callback(new Error("no number"), null);
	}
	if(!opt.subject) {
		return callback(new Error("no subject"), null);
	}
	var params = {};
	params.number = util.isArray(opt.number) ? opt.number.join(",") : opt.number.toString();
	params.subject = opt.subject.toString();
	if(opt.message) params.message = opt.message.toString();
	
	if(opt.originator) params.originator = opt.originator;
	if(opt.account) params.account = opt.account;
	if(opt.filename) params.account = opt.filename;
	if(opt.contentType) params.account = opt.contentType;
	
	if(opt.attachment) {
		var that = this;
		if( opt.attachment.substr(0,1) == "@" ) {
			fs.readFile( opt.attachment.substr(1,opt.attachment.length), function(err,data){
				if( err ) return callback(err,null);
				opt.attachment = new Buffer(attachment).toString('base64')
				that.request( url, "POST", params, callback );
			} );
		} else {
			opt.attachment = new Buffer(attachment).toString('base64')
		}
		params.attachment = opt.message.toString();
		this.request( url, "POST", params, callback );
	}
	return this;
};


/**
 * Quota abfragen
 *
 * @param String opt.moduleID Identifikation für Dienst und Umgebung:<ul>[<Para>"SmsProduction": Send SMS, Produktionsumgebung</Para>[<Para>"SmsSandbox": Send SMS, Sandbox-Umgebung</Para>[<Para>"MmsProduction": Send MMS, Produktionsumgebung</Para>[<Para>"MmsSandbox": Send MMS, Sandbox-Umgebung</Para>[<Para>"VoiceButlerProduction": Voice Call, Produktionsumgebung</Para>[<Para>"VoiceButlerSandbox": Voice Call, Sandbox-Umgebung</Para>[<Para>"CCSProduction": Conference Call, Produktionsumgebung</Para>[<Para>"CCSSandbox": Conference Call, Sandbox-Umgebung</Para>[<Para>"IPLocationProduction": IP Location, Produktionsumgebung</Para>[<Para>"IPLocationSandbox": IP Location, Sandbox-Umgebung</Para>]]]]]]]]]]</ul>
 * @return GetQuotaInformationResponse The result of the operation Quota abfragen
 */
service_client.prototype.quota = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-admin/rest/<environment>/quotainfo/';
	if(!opt.moduleID) {
		return callback(new Error("no moduleID"), null);
	}
	url += encodeURIComponent(opt.moduleID);
	var params = {};
	
	return this.request( url, "GET", params, callback );
};

/**
 * Quota setzen
 *
 * @param String opt.moduleID Identifikation für Dienst und Umgebung:<ul>[<Para>"SmsProduction": Send SMS, Produktionsumgebung</Para>[<Para>"SmsSandbox": Send SMS, Sandbox-Umgebung</Para>[<Para>"MmsProduction": Send MMS, Produktionsumgebung</Para>[<Para>"MmsSandbox": Send MMS, Sandbox-Umgebung</Para>[<Para>"VoiceButlerProduction": Voice Call, Produktionsumgebung</Para>[<Para>"VoiceButlerSandbox": Voice Call, Sandbox-Umgebung</Para>[<Para>"CCSProduction": Conference Call, Produktionsumgebung</Para>[<Para>"CCSSandbox": Conference Call, Sandbox-Umgebung</Para>[<Para>"IPLocationProduction": IP Location, Produktionsumgebung</Para>[<Para>"IPLocationSandbox": IP Location, Sandbox-Umgebung</Para>]]]]]]]]]]</ul>
 * @param string opt.value Die neue maximal verfügbare Quota pro Tag
 * @return ChangeQuotaPoolResponse The result of the operation Quota setzen
 */
service_client.prototype.quotaSet = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-admin/rest/<environment>/quotainfo/';
	if(!opt.moduleID) {
		return callback(new Error("no moduleID"), null);
	}
	if(!opt.value) {
		return callback(new Error("no value"), null);
	}
	url += encodeURIComponent(opt.moduleID);
	var params = {
		value: opt.value
	};
	return this.request( url, "PUT", params, callback );
};

/**
 * Kontostandsabfrage durchführen
 *
 * @param string opt.accountID Konto-ID des Unterkontos, über welches die Service-Nutzung abgerechnet werden soll. Wird der Parameter nicht angegeben, erfolgt die Abrechnung über das Hauptkonto.Siehe: Kontobasierte Servicenutzung
 * @return GetAccountBalanceResponse The result of the operation Kontostandsabfrage durchführen
 */
service_client.prototype.quotaAccountBalance = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-admin/rest/<environment>/account/balance';
	var params = {};
	if( opt.accountID ) params.accountID = opt.accountID.toString();
	return this.request( url, "POST", params, callback );
};


/**
 * Ortsinformationen einer IP-Adresse ermitteln
 *
 * @param string opt.ipaddress Kommaseparierte Liste von IP-Adressen, die lokalisiert werden sollen.
 * @return LocateIpResponse The result of the operation Ortsinformationen einer IP-Adresse ermitteln
 */
service_client.prototype.locateIp = function(opt, callback){ 
	var url = 'https://gateway.developer.telekom.com/p3gw-mod-odg-iplocation/rest/<environment>/location';
	if(!opt.ipaddress) {
		return callback(new Error("no ipaddress"), null);
	}
	var params = {};
	if( opt.ipaddress ) params.ipaddress = opt.ipaddress.toString();
	return this.request( url, "GET", params, callback );
};

exports = module.exports = service_client;