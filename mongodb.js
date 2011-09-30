// initialize
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/topgun');

// Building Schema 
var UserSchema = new Schema({
    id       : { type: Number, index: true }
  , position : Number 
});

var DBUser = mongoose.model('Users', UserSchema);


