/**
 * New node file
 */
var brain = require('convnetjs');
var stock = require('../models/stock');
var async = require('async');

var mean = function ( array ) {
  var sum = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i];
  }
  return sum / array.length;
};

var meanStock = function ( array ) {
  var sum = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i].close;
  }
  return sum / array.length;
};

var trainNet = function ( code, callback ) {
  var layer = [];
  layer.push({
    type : 'input',
    out_sx : 1,
    out_sy : 1,
    out_depth : 10
  });
  layer.push({
    type : 'fc',
    num_neurons : 10
  });
  layer.push({
    type : 'fc',
    num_neurons : 8,
    activation : 'sigmoid'
  });
  layer.push({
    type : 'fc',
    num_neurons : 5
  });
  layer.push({
    type : 'regression',
    num_neurons : 3
  });
  var net = new brain.Net();
  net.makeLayers(layer);

  var trainer = new brain.Trainer(net, {
    method : 'adadelta',
    l2_decay : 0.001,
    batch_size : 10
  });

  stock.load(code, function ( err, item ) {
    var ma = [];
    var prev = {};

    async.each(item.dailyData, function ( curr, cb ) {
      if ( ma.length > 20 ) {
        var ma5 = mean(ma.slice(-5));
        var ma20 = mean(ma.slice(-20));
        var ma60 = mean(ma);
        
        if (prev.NAV === undefined){
          prev.NAV = prev.close;
        }

        var x = new brain.Vol(1, 1, 10);
        x.w[0] = ma5 / (prev.start * 2);
        x.w[1] = ma20 / (prev.start * 2);
        x.w[2] = ma60 / (prev.start * 2);
        x.w[4] = prev.close / (prev.start * 2);
        x.w[5] = prev.high / (prev.start * 2);
        x.w[6] = prev.low / (prev.start * 2);
        x.w[7] = prev.NAV / (prev.start * 2);
        x.w[8] = prev.volume / 10000000;
        x.w[9] = 1;

        var y = [];
        y.push(curr.close / (curr.start * 2));
        y.push(curr.high / (curr.start * 2));
        y.push(curr.low / (curr.start * 2));

        trainer.train(x, y);
      }

      ma.push(curr.close);
      ma = ma.slice(-60);
      prev = curr;
    }, callback);
  });

  exports.net[code] = net;
};

module.exports = exports = {
  net : {},
  train : function () {
    stock.getCodes(function ( codes ) {
      async.each(codes, trainNet);
    });
  },
  expect : function ( code, callback ) {
    stock.load(code, function ( err, item ) {
      var data = item.dailyData.slice(-61);
      var prev = data[data.length - 1];
      var curr = data[data.length - 2];
      data = data.slice(0, 60);

      if (prev.NAV === undefined){
        prev.NAV = prev.close;
      }
      
      var x = new brain.Vol(1, 1, 10);
      x.w[0] = meanStock(data.slice(-5)) / (prev.start * 2);
      x.w[1] = meanStock(data.slice(-20)) / (prev.start * 2);
      x.w[2] = meanStock(data.slice(-60)) / (prev.start * 2);
      x.w[4] = prev.close / (prev.start * 2);
      x.w[5] = prev.high / (prev.start * 2);
      x.w[6] = prev.low / (prev.start * 2);
      x.w[7] = prev.NAV / (prev.start * 2);
      x.w[8] = prev.volume / 10000000;
      x.w[9] = 1;

      console.log(x);
      var expect = exports.net[code].forward(x).w;
      expect[0] = expect[0] * curr.start * 2;
      expect[1] = expect[1] * curr.start * 2;
      expect[2] = expect[2] * curr.start * 2;

      callback(item.title, data, expect);
    });
  }
};