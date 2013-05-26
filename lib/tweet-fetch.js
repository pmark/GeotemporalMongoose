(function() {
	var http = require('http');
	var url = require('url');
	var querystring = require('querystring');

    var errorData = {
        code: 500,
        msg: "Error"
    };

	exports.search = function(latitude, longitude, km, limit, done) {
    	try {
		    var params = {
		    	"geocode": (latitude + "," + longitude + "," + km + "km"),
		    	"since_id": '', 
		    	"max_id": '', 
		    	"result_type": "recent",
		    	"count": limit
		    };

		    var parts = [];

		    for (var key in params) {
		    	parts.push(key + "=" + params[key]);
		    }

			var parsedUri = url.parse("http://geotemporal-tweetserver.herokuapp.com/search/tweets?" + parts.join("&"));

		    var options = {
		       host: parsedUri.hostname,
		       port: parsedUri.port,
		       path: parsedUri.path,
		       method: 'GET',
		       headers: {
		            'Accept': 'application/json'
		       }
		    };

            console.log("tweetserver request:", options);

	        var req = http.request(options, function(resp) {

	            var data = '';

	            resp.setEncoding('utf8');

	            resp.on('data', function(chunk) {
	                data += chunk;
	            });

	            resp.on('end', function() {
	                console.log("tweetserver response:", resp.statusCode); //, resp.headers, data);
	                done(JSON.parse(data));
	            });
	        });

	        req.on('error', function(e) {
		    	console.log("Request error: ", e);
	        	errorData.msg = e.message;
	            done(errorData);
	        });

		    // var query = JSON.stringify(params);
		    // console.log("query: ", query);
    
	        req.write('');
	        req.end();        
	    }
	    catch(e) {
	    	console.log("Exception: ", e);
        	errorData.msg = e.message;
	        done(errorData);
	    }
    };

})();