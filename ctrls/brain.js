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
    num_neurons : 9
  });
  layer.push({
    type : 'fc',
    num_neurons : 7,
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
    exports.progress[code] = 0;

    async.each(item.dailyData, function ( curr, cb ) {
      if ( ma.length > 20 ) {
        var ma5 = mean(ma.slice(-5));
        var ma20 = mean(ma.slice(-20));
        var ma60 = mean(ma);

        if ( prev.NAV === undefined ) {
          prev.NAV = prev.close;
        }

        if ( prev.NAV === undefined ) {
          prev.NAV = prev.close;
        }

        var x = new brain.Vol(1, 1, 10);
        x.w[0] = ma5;
        x.w[1] = ma20;
        x.w[2] = ma60;
        x.w[4] = prev.close;
        x.w[5] = prev.high;
        x.w[6] = prev.low;
        x.w[7] = prev.NAV;
        x.w[8] = prev.volume / 1000;
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
      exports.progress[code] += 1;
      cb();
    }, function () {
      exports.net[code] = exports.training[code];
      callback();
    });
  });

  exports.training[code] = net;
};

module.exports = exports = {
  net : {},
  training : {},
  progress : {},
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
      var expect = [ 0, 0, 0 ];
      data = data.slice(0, 60);

      if ( exports.net[code] ) {
        if ( prev.NAV === undefined ) {
          prev.NAV = prev.close;
        }

        var x = new brain.Vol(1, 1, 10);
        x.w[0] = meanStock(data.slice(-5));
        x.w[1] = meanStock(data.slice(-20));
        x.w[2] = meanStock(data.slice(-60));
        x.w[4] = prev.close;
        x.w[5] = prev.high;
        x.w[6] = prev.low;
        x.w[7] = prev.NAV;
        x.w[8] = prev.volume / 1000;
        x.w[9] = 1;

        expect = exports.net[code].forward(x).w;
      }

      callback({
        title : item.title,
        progress : (exports.progress[code] / item.dailyData.length)
      }, data, expect);
    });
  }
};
