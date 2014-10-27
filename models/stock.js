/**
 * ./models/stock.js Saving stock information & Data handlers.
 */

var mongoose = require('mongoose');
var async = require('async');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://bydelta.kr/stocks', {keepAlive: 1});
var StockScheme = {
  title : String,
  code : {
    type : String,
    unique : true,
    sparse : true
  },
  dailyData : [
    {
      at : String,
      start : Number,
      close : Number,
      high : Number,
      low : Number,
      volume : Number
    }
  ],
  expect : [],
  trade : [],
  thr : {},
  amount : Number,
  balance : Number
};

var Stock = mongoose.model('Stock', new Schema(StockScheme));

module.exports = {
  init : function( data, callback ) {
    new Stock(data).save(callback);
  },
  save : function( code, data ) {
    Stock.findOne({
      code : code
    }, function( err, stock ) {
      if ( stock !== null ) {
        var daily = stock.dailyData;

        if ( !daily[daily.length - 1].close ) {
          async.each(Object.keys(data), function( item, cb ) {
            daily[daily.length - 1][item] = data[item];
            cb();
          }, stock.save);
        } else {
          daily.push(data);
          stock.save();
        }
      }
    });
  },
  load : function( code, callback ) {
    Stock.findOne({
      code : code
    }, callback);
  },
  getCodes : function( callback ) {
    Stock.find({}, function( err, stocks ) {
      async.reduce(stocks, [], function( set, stock, cb ) {
        set.push(stock.code);
        cb(false, set);
      }, callback);
    });
  },
  getAll : function( callback ) {
    Stock.find({}, callback);
  }
}
