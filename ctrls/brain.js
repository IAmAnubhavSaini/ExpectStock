/**
 * New node file
 */
var brain = require('convnetjs');
var stock = require('../models/stock');
var async = require('async');

var meanStock = function ( array ) {
  var sum = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i].close;
  }
  return sum / array.length;
};
var minStock = function ( array ) {
  var min = Number.MAX_VALUE;
  for ( var i = 0; i < array.length; i++ ) {
    min = (min > array[i].low) ? array[i].low : min;
  }
  return min;
};
var maxStock = function ( array ) {
  var max = Number.MIN_VALUE;
  for ( var i = 0; i < array.length; i++ ) {
    max = (max < array[i].high) ? array[i].high : max;
  }
  return max;
};

var network = function () {
  var layer = [];
  layer.push({
    type : 'input',
    out_sx : 5,
    out_sy : 21,
    out_depth : 1
  });
  layer.push({
    type : 'fc',
    num_neurons : 21,
    activation : 'relu'
  });
  layer.push({
    type : 'fc',
    num_neurons : 7
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
    method : 'adagrad',
    l2_decay : 0.001,
    l1_decay : 0.001,
    batch_size : 10
  });

  return {
    net : net,
    trainer : trainer
  };
};

var trainNet = function ( code, callback ) {
  stock.load(code, function ( err, item ) {
    var ma = [];
    var prev = {};
    exports.progress[code] = 0;
    var net = network();

    async.each(item.dailyData, function ( curr, cb ) {
      if ( ma.length > 20 ) {
        if ( prev.NAV === undefined ) {
          prev.NAV = prev.close;
        }

        var x = new brain.Vol(5, 21, 1);
        x.w[0] = curr.start;
        x.w[1] = meanStock(ma.slice(-5));
        x.w[2] = maxStock(ma.slice(-5));
        x.w[3] = minStock(ma.slice(-5));
        x.w[4] = meanStock(ma);

        for ( var i = 0; i < 20; i += 1 ) {
          x.w[5 + i * 5] = ma[ma.length - 1 - i].start;
          x.w[6 + i * 5] = ma[ma.length - 1 - i].close;
          x.w[7 + i * 5] = ma[ma.length - 1 - i].high;
          x.w[8 + i * 5] = ma[ma.length - 1 - i].low;
          x.w[9 + i * 5] = ma[ma.length - 1 - i].NAV;
        }

        var y = [];
        y.push(curr.close);
        y.push(curr.high);
        y.push(curr.low);

        net.trainer.train(x, y);
      }

      ma.push(curr);
      ma = ma.slice(-60);
      prev = curr;
      exports.progress[code] += 1;
      cb();
    }, function () {
      exports.net[code] = net.net;
      callback();
    });
  });
};

module.exports = exports = {
  net : {},
  training : {},
  progress : {},
  train : function () {
    stock.getCodes(function ( codes ) {
      console.log('TRAIN STARTED');
      async.each(codes, trainNet, function () {
        console.log('TRAIN FINISHED');
      });
    });
  },
  expect : function ( code, callback ) {
    stock.load(code, function ( err, item ) {
      var data = item.dailyData.slice(-61);
      var prev = data[data.length - 2];
      var curr = data[data.length - 1];
      var expect = [ 0, 0, 0 ];
      data = data.slice(0, 60);

      if ( exports.net[code] ) {
        if ( prev.NAV === undefined ) {
          prev.NAV = prev.close;
        }

        var x = new brain.Vol(5, 21, 1);
        x.w[0] = curr.start;
        x.w[1] = meanStock(data.slice(-5));
        x.w[2] = maxStock(data.slice(-5));
        x.w[3] = minStock(data.slice(-5));
        x.w[4] = meanStock(data);

        for ( var i = 0; i < 20; i += 1 ) {
          x.w[5 + i * 5] = data[data.length - 1 - i].start;
          x.w[6 + i * 5] = data[data.length - 1 - i].close;
          x.w[7 + i * 5] = data[data.length - 1 - i].high;
          x.w[8 + i * 5] = data[data.length - 1 - i].low;
          x.w[9 + i * 5] = data[data.length - 1 - i].NAV;
        }

        expect = exports.net[code].forward(x).w;
      }

      callback({
        title : item.title,
        progress : (exports.progress[code] / item.dailyData.length)
      }, data, expect);
    });
  }
};
