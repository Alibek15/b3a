const mongoose = require('mongoose');

const weatherSchema = new mongoose.Schema({
    city: String,
    temperature: Number,
    description: String,
    icon: String,
    sunrise: String, 
    sunset: String, 
    hummidity:Number,
    windSpeed:Number,
    max_temp:Number,
    min_temp:Number,
    pressure:String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: { type: Date, default: Date.now }
});

const Weather = mongoose.model('Weather', weatherSchema);

module.exports = Weather;
