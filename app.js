/**
 * Module dependencies.
 */

var express = require('express');
var stylus = require('stylus');
var nib = require('nib');
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var latLong = require('./public/javascripts/latlong');

// Mongoose
mongoose.connect('mongodb://localhost/topgun');
var UserSchema = new Schema({
    id        : { type: Number, index: true }
  , airbase   : { type: String, default: 'A' } 
  , latitude  : Number
  , longitude : Number
  , degree    : { type: Number, default: 0 }
  , created   :  { type: Date, default: Date.now }
  , modified  :  { type: Date, default: Date.now }
  , is_play   :  { type: Number, default: 1 }
});

var Users = mongoose.model('Users', UserSchema);

/** @this Exports */
var app = module.exports = express.createServer();

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(stylus.middleware({
      src: __dirname + '/public',
      compile: compile
  }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
  app.use(express.errorHandler());
});

// Routes
app.get('/', function(req, res) {
  res.render('index', {
    title: 'Topgun Homepage',
    front: true
  });
});

app.get('/setup', function(req, res) {
  res.render('setup', {
    title: 'Choose your fighter and air base!'
  });
});

app.get('/zone', function(req, res) {
  res.render('zone', {
    title: 'War Zone!'
  });
});

app.listen(3000);

/**
 * NOW JS
 */
var nowjs = require('now');
var everyone = nowjs.initialize(app);

var minLat = 0,
    maxLat = 10,
    minLong = 110,
    maxLong = 120;
    
var counting;
var distribute;
var userList;

/**
 * Start scanning all users coordinate every 1 seconds 
 */
enterDistribute();

function enterDistribute() {
    distribute = setTimeout(function() { enterDistribute() }, 1000);
    
    Users.find({ 'modified': { $gte: Date.now()-2000 },'is_play': 1 }, function(err, docs){
        userList = docs;
    });
};

/**
 * When user connected with NOWJS server
 */
nowjs.on('connect', function() {
    new Users({ id: this.user.clientId, airbase: 'A',  latitude: '5', longitude: '115' }).save(); 
});

/**
* When user disconnect from Game
* clearTimeout and delete user clientId from MongoDB
*/
nowjs.on('disconnect', function() {
    Users.update({ id: this.user.clientId }, { is_play: 0}, (function(tunnel, err){
        console.log('Left : ' + this.user.clientId);
    }).bind(this,"tunnel"));
    
    clearTimeout(counting);
});

/**
 * User ready to start Game
 * update user position every seconds
 */
everyone.now.startGame = function() {
    counter(this.user.clientId);    
}; 

function counter(userId){
    everyone.now.startUserGame(userId);
    counting = setTimeout(function() { counter(userId) }, 1000);
};

/** Converts numeric degrees to radians */
if (typeof(Number.prototype.toRad) === "undefined") {
Number.prototype.toRad = function() {
    return this * Math.PI / 180;
    }
}

/** Converts radians to numeric (signed) degrees */
if (typeof(Number.prototype.toDeg) === "undefined") {
  Number.prototype.toDeg = function() {
    return this * 180 / Math.PI;
  }
}

/**
 * Creates a point on the earth's surface at the supplied latitude / longitude
 *
 * @constructor
 * @param {Number} lat: latitude in numeric degrees
 * @param {Number} lon: longitude in numeric degrees
 * @param {Number} [rad=6371]: radius of earth if different value is required from standard 6,371km
 */
function LatLon(lat, lon, rad) {
  if (typeof(rad) == 'undefined') rad = 6371;  // earth's mean radius in km
  // only accept numbers or valid numeric strings
  this._lat = typeof(lat)=='number' ? lat : typeof(lat)=='string' && lat.trim()!='' ? +lat : NaN;
  this._lon = typeof(lon)=='number' ? lon : typeof(lon)=='string' && lon.trim()!='' ? +lon : NaN;
  this._radius = typeof(rad)=='number' ? rad : typeof(rad)=='string' && trim(lon)!='' ? +rad : NaN;
}

/**
 * Start Game with set position latitude and longitude
 */
everyone.now.startUserGame = function(userId) {
    if(this.user.clientId === userId){
 
        Users.findOne({ 'id': this.user.clientId }, (function(tunnel, err, user){
            if(!err && user !== null){
                var d = 10;    // kilometers
                var R = 6371;  // earth radius
                var getLat1 = user.latitude;                
                var getLon1 = user.longitude;
                var brng = user.degree;
                
                dist = d/R;  // convert dist to angular distance in radians
                brng = brng.toRad();  // 
                var lat1 = getLat1.toRad(), lon1 = getLon1.toRad();

                var lat2 = Math.asin( Math.sin(lat1)*Math.cos(dist) + 
                                        Math.cos(lat1)*Math.sin(dist)*Math.cos(brng));
                var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(dist)*Math.cos(lat1), 
                                            Math.cos(dist)-Math.sin(lat1)*Math.sin(lat2));
                lon2 = (lon2+3*Math.PI) % (2*Math.PI) - Math.PI;  // normalise to -180..+180º

                var resulting = new LatLon(lat2.toDeg(), lon2.toDeg());
               
                var lat2 = resulting._lat;
                var lon2 = resulting._lon;
                
                if(lat2 > maxLat){ lat2 = minLat; }
                if(lat2 < minLat){ lat2 = maxLat; }
                if(lon2 > maxLong) { lon2 = minLong; }
                if(lon2 < minLong) { lon2 = maxLong; }
                
                var updateData = {
                    latitude: lat2, 
                    longitude: lon2, 
                    modified: Date.now() 
                };

                
                Users.update({ id: user.id }, updateData, (function(tunnel, err) {
                    var player = {
                        'latitude': updateData.latitude,
                        'longitude': updateData.longitude,
                        'id': user.id,
                        'airbase': user.airbase,
                        'degree' : user.degree
                    };
                    this.now.userPosition(player, userList);
                    /* console.log( 'After:' + updateData.latitude + ' ,' + updateData.longitude); */
                }).bind(this, "tunnel"));

            }
        }).bind(this, "tunnel"));
        
    } 
};

/**
 * Detecting User movement degree
 */
everyone.now.userMovement = function(val) {
    Users.findOne({ 'id': this.user.clientId }, (function(tunnel, err, user){
        /* Calculate user degree in 0 - 360 degree only */
        getMove = user.degree+val;
        
        updateDegree = getMove % 360;
        if(updateDegree < 0){
            updateDegree += 360;
        }

        Users.update({ id: this.user.clientId }, { degree: updateDegree }, (function(tunnel, err) {
            this.now.updateUserDegree(updateDegree);
            console.log( this.user.clientId + ' move ' + updateDegree + ' degree');
        }).bind(this, "tunnel"));
    }).bind(this, "tunnel"));
};

function perRound(num, precision) {
    var precision = 3; //default value if not passed from caller, change if desired
    // remark if passed from caller
    precision = parseInt(precision); // make certain the decimal precision is an integer
    var result1 = num * Math.pow(10, precision);
    var result2 = Math.round(result1);
    var result3 = result2 / Math.pow(10, precision);

    return zerosPad(result3, precision);
}


function zerosPad(rndVal, decPlaces) {
    var valStrg = rndVal.toString(); // Convert the number to a string
    var decLoc = valStrg.indexOf("."); // Locate the decimal point
    // check for a decimal 
    if (decLoc == -1) {
        decPartLen = 0; // If no decimal, then all decimal places will be padded with 0s
        // If decPlaces is greater than zero, add a decimal point
        valStrg += decPlaces > 0 ? "." : "";
    }else {
        decPartLen = valStrg.length - decLoc - 1; // If there is a decimal already, only the needed decimal places will be padded with 0s
    }

    var totalPad = decPlaces - decPartLen;    // Calculate the number of decimal places that need to be padded with 0s
    
    if (totalPad > 0) {
        // Pad the string with 0s
        for (var cntrVal = 1; cntrVal <= totalPad; cntrVal++) 
            valStrg += "0";
        }
    return valStrg;
}

/**
 * Get Distance between two coordinate
 */
function getDistance(params) {
    var x1 = params['x1'];
    var y1 = parans['y1'];
    var x2 = params['x2'];
    var y2 = params['y2'];
    var xdiff = x2 - x1;
    var ydiff = y2 - y1;
    //console.log(Math.pow((xdiff * xdiff + ydiff * ydiff), 0.5));
    
    return perRound(Math.pow((xdiff * xdiff + ydiff * ydiff), 0.5));
}

console.log('Express %d in %s mode', app.address().port, app.settings.env);
