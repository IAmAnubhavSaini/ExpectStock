/**
 * New node file
 */
var brain = require('dnn');
var stock = require('../models/stock');
var async = require('async');

var max = function ( array, key ) {
  var max = Number.MIN_VALUE;
  for ( var i = 0; i < array.length; i++ ) {
    max = max > array[i][key] ? max : array[i][key];
  }
  return max;
};

var min = function ( array, key ) {
  var min = Number.MAX_VALUE;
  for ( var i = 0; i < array.length; i++ ) {
    min = min < array[i][key] ? min : array[i][key];
  }
  return min;
};

var avg = function ( array, key ) {
  var sum = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i][key];
  }
  return sum / array.length;
};

var std = function ( array, key ) {
  var sum = 0, sumsq = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i][key];
    sumsq += array[i][key] * array[i][key];
  }
  var avg = sum / array.length, avgsq = sumsq / array.length;
  return Math.sqrt(avgsq - avg * avg);
};

var input = function ( train ) {
  var set = {
    high : max(train, 'high'),
    low : min(train, 'low'),
    vol : {
      avg : avg(train, 'volume'),
      std : std(train, 'volume'),
    }
  };
  var out = [], prev = [];
  var norm = function ( value ) {
    return (value - set.low) / (set.high - set.low);
  };
  var rect = function ( value ) {
    var upper = set.vol.avg + set.vol.std;
    if ( value > upper ) {
      return 1;
    } else {
      return value / upper;
    }
  };

  for ( var i = 1; i < train.length; i++ ) {
    var item = train[i];

    var change = train[i].close - train[i - 1].close;
    if ( change > 0 ) {
      prev.push({
        pos : change,
        neg : 0
      });
    } else {
      prev.push({
        neg : -change,
        pos : 0
      });
    }

    if ( i > 3 ) {
      // Stochastic
      var min5 = min(train.slice(i - 4, i + 1), 'low');
      var max5 = max(train.slice(i - 4, i + 1), 'high');
      var k = (train[i].close - min5) / (max5 - min5);
      prev[prev.length - 1].k = k;
    }

    if ( i > 7 ) {
      out.push(norm(train[i].start));
      out.push(norm(train[i].close));
      out.push(norm(train[i].low));
      out.push(norm(train[i].high));
      out.push(rect(train[i].start));
      // RSI
      out.push(avg(prev, 'pos') / (avg(prev, 'pos') + avg(prev, 'neg')));
      // Stochastic
      out.push(k);
      out.push(avg(prev, 'k'));

      prev.shift();
    }
  }

  return out;
};

var label = function ( curr, next ) {
  return [ (curr.close < next[0].close) ? 1 : 0,
      (curr.close < next[2].close) ? 1 : 0,
      (curr.close < next[4].close) ? 1 : 0,
      (curr.low > min(next, 'low')) ? 1 : 0,
      (curr.high < max(next, 'high')) ? 1 : 0,
      (curr.low > min(next.slice(0, 3), 'low')) ? 1 : 0,
      (curr.high > max(next.slice(0, 3), 'high')) ? 1 : 0, ];
};

var hLayerSizes = function ( xlen, ylen ) {
  var h = [];
  h.push(Math.floor(xlen / 8));
  h.push(Math.floor(xlen / 64 + ylen / 2));

  return h;
};

module.exports = exports = {
  net : null,
  train : function () {
    stock.getAll(function ( err, stocks ) {
      console.log('TRAIN SET CREATION');
      async.reduce(stocks, {
        x : [],
        y : []
      }, function ( labels, stock, next ) {
        console.log(stock.code, stock.title);
        if ( stock.dailyData !== undefined ) {
          var set = [];
          async.times(stock.dailyData.length - 5, function ( index, step ) {
            var last = stock.dailyData[index];
            set.push(last);
            if ( set.length == 70 ) {
              var i = input(set);
              var o = label(last, stock.dailyData.slice(index + 1, index + 6));
              labels.x.push(i);
              labels.y.push(o);
              set.shift();
            }
            step();
          }, function () {
            next(false, labels);
          });
        } else {
          next(false, labels);
        }
      },
          function ( err, labels ) {
            if ( !err && labels.x.length > 0 ) {
              var nIn = labels.x[0].length;
              var nOut = labels.y[0].length;
              console.log('TRAIN SET CREATION COMPLETE : ' + labels.x.length
                  + ' x ' + nIn);
              var layers = hLayerSizes(nIn, nOut);
              console.log('LAYERS : ' + layers.join('→') + '→' + nOut);
              if (exports.net === null){
                exports.net = new brain.CDBN({
                  'input' : labels.x,
                  'label' : labels.y,
                  'n_ins' : nIn,
                  'n_outs' : nOut,
                  'hidden_layer_sizes' : layers
                });
                exports.net.set('log level', 1);
                console.log(new Date(), 'START PRE_TRAINING (NEW)');
                exports.net.pretrain({
                  'lr' : 0.8,
                  'k' : 1,
                  'epochs' : 10
                });
                console.log(new Date(), 'START TRAINING');
                exports.net.finetune({
                  'lr' : 0.84,
                  'epochs' : 7
                });
              }else{
                exports.net.x = labels.x;
                exports.net.y = labels.y;
                console.log(new Date(), 'START PRE_TRAINING');
                exports.net.pretrain({
                  'lr' : 0.8,
                  'k' : 1,
                  'epochs' : 3
                });
                console.log(new Date(), 'START TRAINING');
                exports.net.finetune({
                  'lr' : 0.84,
                  'epochs' : 3
                });
              }
              console.log(new Date(), 'END TRAINING');
            } else {
              console.log('NO TRAIN DATA');
            }
          });
    });
  },
  expect : function ( code, callback ) {
    stock.load(code, function ( err, item ) {
      var data = item.dailyData.slice(-70);
      var expect = [ 0, 0, 0, 0, 0, 0, 0 ];
      if ( exports.net ) {
        expect = exports.net.predict([input(data)])[0];
      }

      callback({
        title : item.title
      }, data, expect);
    });
  }
};
