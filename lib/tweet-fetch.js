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
            "count": limit * 200
        };

        var parts = [];

        for (var key in params) {
            parts.push(key + "=" + params[key]);
        }

    var parsedUri = '';
    if (process.env.NODE_ENV === 'development') {
        parsedUri = url.parse("http://localhost:4000/search/tweets?" + parts.join("&"));
    }
    else {
        parsedUri = url.parse("http://geotemporal-tweetserver.herokuapp.com/search/tweets?" + parts.join("&"));
    }

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
                var parsedData = {};

                resp.setEncoding('utf8');

                resp.on('data', function(chunk) {
                    data += chunk;
                });

                resp.on('end', function() {
                    console.log("tweetserver response:", resp.statusCode); //, resp.headers, data);
                    parsedData = JSON.parse(data);
                    done(geoFilter(parsedData));
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

function geoFilter(data) {
    var output = {};
    if (data.hasOwnProperty('statuses')) {
        output.statuses = [];
        if (data.hasOwnProperty('search_metadata')) {
            output.search_metadata = data.search_metadata;
        }
        var e;
        for (var i = 0; i < data.statuses.length; i++) {
            e = data.statuses[i];
            if ((e.geo != null && e.coordinates === null) || (e.geo === null && e.coordinates != null)) {
                throw new Error("We expected both geo and coordinates to be valid when coordinates are available, but apparently that's not the case");
            }

            if (e.geo != null) {
                output.statuses.push(e);
            }
        }
    }
    return output;
}


















