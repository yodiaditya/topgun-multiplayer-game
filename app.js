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
  , speed     : { type: Number, default: 1 }
  , degree    : { type: Number, default: 0 }
  , created   :  { type: Date, default: Date.now }
  , modified  :  { type: Date, default: Date.now }
  , is_play   :  { type: Number, default: 1 }
});

var Users = mongoose.model('Users', UserSchema);

var MissileSchema = new Schema({
    player_id  : Number
  , enemy_id   : Number
  , rlatitude  : Number
  , rlongitude : Number
  , platitude  : Number
  , plongitude : Number
  , degree     : Number
  , speed     : { type: Number, default:10 }
  , time      : Number
  , created   :  { type: Date, default: Date.now }
  , modified  :  { type: Date, default: Date.now }
  , is_progress :  { type: Number, default: 1 }
});


var Missile = mongoose.model('Missile', MissileSchema);

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
/* var everyone = nowjs.initialize(app); */

var everyone = require('now').initialize(app, {
        socketio: {transports: ['xhr-polling', 'jsonp-polling']}
     });

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
    distribute = setTimeout(function() { enterDistribute() }, 500);
    
    Users.find({ 'modified': { $gte: Date.now()-2000 },'is_play': 1 }, function(err, docs){
        userList = docs;
    });
   
    updateMissile();
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
    /* do something here */
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
    counting = setTimeout(function() { counter(userId) }, 500);
};

/**
 * Start Game with set position latitude and longitude
 */
everyone.now.startUserGame = function(userId) {
    if(this.user.clientId === userId){
 
        Users.findOne({ 'id': this.user.clientId }, (function(tunnel, err, user){
            if(!err && user !== null){
                var resulting = nextPoints(user.speed, user.latitude, user.longitude, user.degree);
                var lat2 = resulting.lat;
                var lon2 = resulting.lon;
                
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
            //console.log( this.user.clientId + ' move ' + updateDegree + ' degree');
        }).bind(this, "tunnel"));
    }).bind(this, "tunnel"));
};

/**
 * Detecting User speed increase / decrease
 */
everyone.now.userSpeed = function(val) {
    Users.findOne({ 'id': this.user.clientId }, (function(tunnel, err, user){
        var getSpeed = user.speed;
        
        if(val == 1){
            getSpeed = getSpeed+1; 
        }else{
            getSpeed = getSpeed -1;
        }
        
        if(getSpeed > 0 && getSpeed < 6){
            Users.update({ id: this.user.clientId }, { speed: getSpeed }, (function(tunnel, err) {
                this.now.updateUserSpeed(getSpeed);
            }).bind(this, "tunnel"));
        } else {
          this.now.updateUserSpeed(user.speed);
        }
    }).bind(this, "tunnel"));
};

/**
 * Shot missile
 */
everyone.now.launchMissile = function() {
    var points = {}, enemyOnTarget = {}, player;
    
    for(var key in userList) {
       if(userList[key].id == this.user.clientId) {
            player = userList[key];
       }
    }
    
    coursesPlayerLeft = player.degree - 10;
    coursesPlayerRight = player.degree + 10;
   
    for(var key in userList) {
       if(userList[key].id != this.user.clientId) { 
            var rangeShots =  calculateDegree(
                    player.latitude,
                    player.longitude,
                    userList[key].latitude, 
                    userList[key].longitude);

            console.log('P: ' + player.degree + ' , E: '+ rangeShots);
            
            if(rangeShots > 350 || rangeShots < 10){
                if(coursesPlayerLeft < 0) {
                    coursesPlayerLeft = coursesPlayerLeft + 360;
                }

                if(coursesPlayerRight > 360) {
                    coursesPlayerRight = coursesPlayerRight - 360;
                }

                if(rangeShots < coursesPlayerRight) {
                    if(player.degree > 355){
                        balanceRight = 360-player.degree;
                        balanceRight = balanceRight - rangeShots;
                    }else{
                        balanceRight = player.degree - rangeShots;
                    }
                    
                    getDegree = Math.abs(balanceRight); 
                    enemyOnTarget[key] = { id: userList[key].id, accuracy: getDegree };

                }else if(rangeShots > coursesPlayerLeft){
                    getDegree = Math.abs(rangeShots-player.degree);
                    enemyOnTarget[key] = { id: userList[key].id, accuracy: getDegree };
                } 
            } else if(rangeShots > coursesPlayerLeft && rangeShots < coursesPlayerRight) {
                getDegree = Math.abs(rangeShots-player.degree);
                enemyOnTarget[key] = { id: userList[key].id, accuracy: getDegree };
            }
       }
    }
  
    getTotalTarget = countInObject(enemyOnTarget);
    
    if(getTotalTarget > 0) {
       var getNumber = {};
       
       for(var enVal in enemyOnTarget) {
           getNumber[enVal] = enemyOnTarget[enVal].accuracy;
       }
     
       var getSelectedEnemy = countInObject(getNumber);
       
       if(getSelectedEnemy > 0){
            var smallest = 10;
            
            for (x=0;x<getSelectedEnemy;x++){
                if(smallest>getNumber[x]) {
                    smallest = getNumber[x];    
                }
            }
           
            var selected = {};
            
            for(var enVal in enemyOnTarget) {
                if(enemyOnTarget[enVal].accuracy == smallest) {
                   selected = enemyOnTarget[enVal]; 
                }
            }
          
            var getEnemyNow = countInObject(selected);
            
            if(getEnemyNow > 0) {
                
                
                for(var key in userList) {
                    getSelectId = parseInt(selected.id); 
                    getUserId = parseInt(userList[key].id);
                    
                    if(getSelectId == getUserId) {
                        
                        var d = distancePoints(player.latitude, player.longitude, userList[key].latitude, userList[key].longitude); 
                        var missileTime = Math.round(d/10);
                            
                        new Missile({ 
                            player_id: this.user.clientId , 
                            enemy_id: userList[key].id ,  
                            rlatitude: player.latitude , 
                            rlongitude: player.longitude ,
                            platitude: userList[key].latitude ,
                            plongitude: userList[key].longitude,
                            degree: player.degree,
                            distance: d,
                            time: missileTime
                        }).save(); 
                        
                        everyone.now.updateLaunchMissile(this.user.clientId, userList[key].id , d , missileTime);                        
                        
                    }
                }
            }
       }
    }
    
};

everyone.now.updateLaunchMissile = function(player_id, enemy_id, d, missileTime) {
    if(this.user.clientId == player_id) {
        this.now.updateLaunch('<strong>Missile launch!</strong> ' + missileTime +' seconds ' + ' (' + d + ' km)');
    }else if(this.user.clientId == enemy_id){
        this.now.updateLaunch('<strong>Incoming missile!</strong> ' + missileTime +' seconds ' + ' (' + d + 'km)');
    }else{
        this.now.updateLaunch(player_id + ' launch missile to ' + enemy_id);
    }
}

function updateMissile() {

    Missile.find({'is_progress': 1}, (function(tunnel, err, missiles) {
        checkMissile = countInObject(missiles);
        if(!err && checkMissile>0) {

            missiles.forEach(function(m) {
                
                var nextPos = nextPoints(10, m.rlatitude, m.rlongitude, m.degree);
                var lat1 = nextPos.lat;
                var lon1 = nextPos.lon;
                
                var getDistance = distancePoints(lat1,lon1,m.platitude,m.plongitude);
                var updateTime = Math.round(getDistance/10);
                var remaining = m.time-updateTime;
                
                if(remaining < 1) {
                    var updateData = {
                        time: 0 ,
                        distance: 0,
                        rlatitude: m.platitude,
                        rlongitude: m.plongitude,
                        is_progress: 0
                    };
               
                    var rocketEnemyDistance;
                    
                    for(var key in userList) {
                        getEnemyId = parseInt(m.enemy_id); 
                        getUserId = parseInt(userList[key].id);
                        
                        if(getEnemyId == getUserId) {
                            rocketEnemyDistance = distancePoints(m.platitude,m.plongitude, userList[key].latitude, userList[key].longitude);
                        }
                    }
                    
                    Missile.update({ _id: m._id  }, updateData , function(err) {
                        if(rocketEnemyDistance < 3) {
                            everyone.now.countMissile(3, m.player_id, m.enemy_id, rocketEnemyDistance, m.time);
                        }else{
                            everyone.now.countMissile(2, m.player_id, m.enemy_id, rocketEnemyDistance, m.time);
                        }
                    });
                
                }else{
                    
                    var updateData = {
                        time: updateTime ,
                        distance: getDistance,
                        rlatitude: lat1,
                        rlongitude: lon1,
                    };
                    
                    Missile.update({ _id: m._id  }, updateData , function(err) {
                        everyone.now.countMissile(0,m.player_id, m.enemy_id, getDistance, m.time);
                    });
                
                }   
            });  
        }   

    }).bind(this,"tunnel"));
}

everyone.now.countMissile = function(mode, player_id, enemy_id, distance, time) {
   console.log(distance);
   
   if( mode == 0) {
        if(this.user.clientId == player_id) {
            this.now.updateStatusMissile('Missile on ' + distance + ' km with ETA : ' + time); 
        }else if(this.user.clientId == enemy_id) {
            this.now.updateStatusMissile('Missile on ' + distance + ' km with ETA : ' + time); 
        }
   }else if(mode == 1){
    if(this.user.clientId == player_id) {
            this.now.updateStatusMissile('Missile missed ' + distance + ' from enemy'); 
    }else if(this.user.clientId == enemy_id) {
            this.now.updateStatusMissile('Succesfully dogde missile near ' + distance + ' km'); 
    }
   }else{
    if(this.user.clientId == player_id) {
            this.now.updateStatusMissile('Success hit enemy!'); 
    }else if(this.user.clientId == enemy_id) {
            this.now.updateStatusMissile('Enemy missile hit you!'); 
    }
   
   }
};


function nextPoints(d,getLat1, getLon1, brng) {
    var R = 6371;  // earth radius
    
    dist = d/R;  // convert dist to angular distance in radians
    brng = brng.toRad();  // 
    var lat1 = getLat1.toRad(), lon1 = getLon1.toRad();

    var lat2 = Math.asin( Math.sin(lat1)*Math.cos(dist) + 
                            Math.cos(lat1)*Math.sin(dist)*Math.cos(brng));
    var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(dist)*Math.cos(lat1), 
                                Math.cos(dist)-Math.sin(lat1)*Math.sin(lat2));
    lon2 = (lon2+3*Math.PI) % (2*Math.PI) - Math.PI;  // normalise to -180..+180º

    var resulting = new LatLon(lat2.toDeg(), lon2.toDeg());
    var nextPoin = { 'lat': resulting._lat, 'lon': resulting._lon };

    return nextPoin; 
}
  
function distancePoints(lat1, lon1, lat2, lon2) {
    
    var R = 6371; // km
    var dLat = (lat2-lat1).toRad();
    var dLon = (lon2-lon1).toRad();
    var lat1 = lat1.toRad();
    var lat2 = lat2.toRad();

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    
    return Math.round(d);
}

function calculateDegree(lat1, lon1,lat2, lon2) {
    // Calculate Degree from Player position with Enemy Position 
    var plat1 = lat1.toRad(), plat2 = lat2.toRad();
    var dLon = (lon2 - lon1).toRad();

    var y = Math.sin(dLon) * Math.cos(plat2);
    var x = Math.cos(plat1)*Math.sin(plat2) -
            Math.sin(plat1)*Math.cos(plat2)*Math.cos(dLon);
    var brng = Math.atan2(y, x);
    var courses = (brng.toDeg()+360) % 360;
    
    return courses;
}

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

function countInObject(obj) {
    var count = 0;
    // iterate over properties, increment if a non-prototype property
    for(var key in obj) if(obj.hasOwnProperty(key)) count++;
    return count;
}

console.log('Express %d in %s mode', app.address().port, app.settings.env);
