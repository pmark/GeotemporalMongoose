//
// geotemporal-mongoose: Node.js based Geotemporal item service using MongoDB with Mongoose
//

// by P. Mark Anderson

//
// Copyright 2013 Seanote
//
// MIT Licensed
//

// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files
// (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:  

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software. 

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE. 

"use strict";

var express = require("express"),
    http = require("http"),
    mongoose = require ("mongoose"),
    tweetFetch = require("./lib/tweet-fetch.js"),
    app = express();

mongoose.set('debug', true);

// Here we find an appropriate database to connect to, defaulting to
// localhost if we don't find one.  
var uristring = 
  process.env.MONGOLAB_URI || 
  process.env.MONGOHQ_URL || 
  'mongodb://localhost/GeotemporalMongoose';

// The http server will listen to an appropriate port, or default to
// port 5000.
var theport = process.env.PORT || 5000;

// Makes connection asynchronously.  Mongoose will queue up database
// operations and release them when the connection is complete.
mongoose.connect(uristring, function (err, res) {
  if (err) { 
    console.log ('ERROR connecting to: ' + uristring + '. ' + err);
  } else {
    console.log ('Succeeded connected to: ' + uristring);
  }
});

var tweetSchema = new mongoose.Schema({ 
    geo: {
        type: { type: String},
        coordinates: []
    },
    created_at: Date,
    tweet_id: Number,
    text: String,
    user_full_name: String,
    username: String
});


// Compiles the schema into a model, opening (or creating, if
// nonexistent) the 'Tweets' collection in the MongoDB database

tweetSchema.index({geo: "2dsphere"}); 
tweetSchema.index({created_at: 1}, { expireAfterSeconds:3600*48}); // 2 days

var Tweets = mongoose.model('Tweets', tweetSchema);

// Tweets.collection.dropAllIndexes(function (err, results) {
//     // Handle errors
//     console.log("drop: ", err, results);
// });




// Clear out old data
Tweets.remove({}, function(err) {
  if (err) {
    console.log ('error deleting old data.');
  }
});

// Creating one item.
/*
var tweet1 = new Tweets ({
    user_full_name: "P. Mark Anderson",
    username: "pmark",
    text: "Test tweet",
    location: {
        type: "Point",
        coordinates: [-122.6750, 45.5236]
    }
});

// Saving it to the database.  
tweet1.save(function (err) {
    if (err)
        console.log('Error on save!', err);
    else
        console.log('Created test tweet.');
});

// Creating more items manually
var janedoe = new Tweets ({
  name: { first: 'Jane', last: 'Doe' },
  age: 65
});
janedoe.save(function (err) {if (err) console.log ('Error on save!')});

// Creating more items manually
var alicesmith = new Tweets ({
  name: { first: 'Alice', last: 'Smith' },
  age: 45
});
alicesmith.save(function (err) {if (err) console.log ('Error on save!')});
*/

app.configure(function() {
    app.set("port", process.env.PORT || 5000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
});

// range is in km
app.get("/twitter/:latitude/:longitude/:range", function(req, res) {

    // Search for results at this location.

    var limit = req.query.limit || 100;

    tweetFetch.search(req.params.latitude, req.params.longitude, req.params.range, limit, function(data) {

        var responseData = {
            tweets: []
        };

        if (data && data.statuses && data.statuses.length) {

            responseData.code = 200;
            responseData.msg = "OK";

            responseData.tweets = [];
            responseData.statuses = [];

            var newTweetData = [];
            var oldTweetData = [];
            var fetchedTweetIds = [];
            var existingTweetIds = [];

            // Find existing tweets in our DB. Don't duplicate data.

            data.statuses.forEach(function(tweetData) {
                fetchedTweetIds.push(tweetData.id);
            });

            Tweets.find({'tweet_id': {$in: fetchedTweetIds} }).exec(function(err, result) { 
                if (err) {
                    console.log("Error fetching tweet:", err);
                }
                else {

                    if (result) {
                        console.log("Found tweets: ", result.length);

                        result.forEach(function(tweet) {
                            existingTweetIds.push(tweet.id);
                            responseData.tweets.push(tweet);
                            console.log("Added old tweet by ", tweet.username);
                        });
                    }
                }
            });


            // Add any new tweets.

            data.statuses.forEach(function(tweetData) {

                if (existingTweetIds.indexOf(tweetData.id) != -1) {
                    console.log("Skipping extant tweet by ", tweetData.user.screen_name);
                    return;
                }

                var userData = tweetData.user || {};
                var latitude = null;
                var longitude = null;
                var coordData = tweetData.geo ? tweetData.geo.coordinates : null;

                if (coordData) {
                    // The 'geo' property exists.
                    latitude = coordData[0];
                    longitude = coordData[1];
                }
                else {
                    // Try using the 'coordinates' property.
                    coordData = tweetData.coordinates;

                    if (coordData) {
                        longitude = coordData[0];
                        latitude = coordData[1];
                    }
                }

                if (coordData && coordData.length) {

                    // Save the geotagged tweet.

                    responseData.statuses.push(tweetData);
                    responseData.tweets.push(
                        {
                            tweet_id: tweetData.id,
                            text: tweetData.text,
                            user_full_name: userData.name,
                            username: userData.screen_name,
                            geo: tweetData.geo
                        }
                    );
                }
            });

            if (newTweetData && newTweetData.length > 0) {
                Tweets.create(newTweetData, function (err) {
                    if (err) {
                        console.log('Error saving tweets:', err);
                    }
                    else {
                        newTweetData.forEach(function(tmpTweet) {
                            responseData.tweets.push(tmpTweet);
                        });

                        console.log(newTweetData.length, "new tweets: ", responseData.tweets);
                    }

                    res.json(responseData);
                });
            }
            else {
                // All tweets already existed

                console.log("All tweets already existed");
                res.json(responseData);
            }

        }
        else {
            responseData.code = 404;
            responseData.msg = "No tweets found.";
            res.json(responseData);
        }

        console.log("\n\nsending response:\n\n", responseData);

                
    });
    
});

app.get("/all", function(req, res) {
    Tweets.find({}).exec(function(err, result) { 
        if (err) {
            console.log("Error fetching tweets:", err);
            res.send("/twitter/:latitude/:longitude/:km");
        }
        else {
            if (result) {
                console.log("Found tweets: ", result.length);

                var responseData = {
                    count:result.length,
                    tweets:result
                };

                res.json(responseData);
            }
        }
    });
});

app.get("/", function(req, res) {
    res.render('index');
});

app.get("/test", function(req, res) {

    // Search for results at this location.


    findNear(45.5236, -122.6750, 10, 100, function(err, docs) {
        if (err) {
            console.log("ERROR: ", err);
            res.send("ERROR:: " + err);
        }
        else {
            var matches = [];

            if (docs && docs.results) {
                docs.results.forEach(function(item) {
                    console.log("item", item.obj);
                    matches.push(item.obj);
                });
            }

            res.send("found points: " + matches.join("<br><br>"));
        }
    });
});


function findNear(latitude, longitude, meters, limit, done) {
    // See http://docs.mongodb.org/manual/reference/command/geoNear/#dbcmd.geoNear

    meters = meters || 16093; // 10 miles
    limit = limit || 100;

    // db.runCommand( { geoNear: "tweets", near: [ -122.6750, 45.5236 ], spherical:true } )
    Tweets.collection.geoNear(longitude, latitude, {
        spherical: true, 
        maxDistance: meters
    }, 
    done);    
    // function(err, docs) {
    //     if (docs.results.length == 1) {
    //         var distance = docs.results[0].dis;
    //         var match = docs.results[0].obj;
    //     }
    // });

    // Tweets.find( { location: { $near: [longitude, latitude] , $maxDistance: meters } }, done );
    return;

    // return Tweets.find({
    //     location: {
    //         coordinates: {
    //             $near: [longitude, latitude]
    //         }
    //     }
    // }, 
    // done);

    // return Tweets.find({ 
    //     location: { 
    //         $geoNear: {
    //             $spherical: true,
    //             $includeLocs: true,
    //             $maxDistance: meters,
    //             $limit: limit,
    //             $near: { 
    //                 coordinates: [ longitude, latitude ]
    //             } 
    //         } 
    //     } 
    // },
    // done);
}


http.createServer(app).listen(app.get("port"), function() {
    console.log("geotemporal-mongoose is now listening on port " + app.get("port"));
});
