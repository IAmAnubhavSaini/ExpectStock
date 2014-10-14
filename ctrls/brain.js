/**
 * New node file
 */
var brain = require('dnn');
var stock = require('../models/stock');
var async = require('async');

const
DAYS = 60 + 8;

var max = function( array, key ) {
  var max = Number.MIN_VALUE;
  for ( var i = 0; i < array.length; i++ ) {
    max = max > array[i][key] ? max : array[i][key];
  }
  return max;
};

var min = function( array, key ) {
  var min = Number.MAX_VALUE;
  for ( var i = 0; i < array.length; i++ ) {
    min = min < array[i][key] ? min : array[i][key];
  }
  return min;
};

var avg = function( array, key ) {
  var sum = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i][key];
  }
  return sum / array.length;
};

var std = function( array, key ) {
  var sum = 0, sumsq = 0;
  for ( var i = 0; i < array.length; i++ ) {
    sum += array[i][key];
    sumsq += array[i][key] * array[i][key];
  }
  var avg = sum / array.length, avgsq = sumsq / array.length;
  return Math.sqrt(avgsq - avg * avg);
};

var input = function( train ) {
  var set = {
    high : max(train, 'high'),
    low : min(train, 'low'),
    vol : {
      avg : avg(train, 'volume'),
      std : std(train, 'volume'),
    }
  };
  var out = [], prev = [];
  var norm = function( value ) {
    if ( set.high === set.low ) {
      return 0.5;
    } else {
      return (value - set.low) / (set.high - set.low);
    }
  };
  var rect = function( value ) {
    var upper = set.vol.avg + set.vol.std;
    if ( value > upper ) {
      return 1;
    } else {
      return value / upper;
    }
  };
  var push = function( value ) {
    if ( isNaN(value) || value === undefined ) {
      out.push(0.5);
    } else if ( value > 1 ) {
      out.push(1);
    } else if ( value < 0 ) {
      out.push(0);
    } else {
      out.push(value);
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
      var k = (max5 === min5) ? 0.5 : (train[i].close - min5) / (max5 - min5);
      prev[prev.length - 1].k = k;
    }

    if ( prev.length > 5 ) {
      prev.shift();
    }

    if ( i > 7 ) {
      push(norm(train[i].start));
      push(norm(train[i].close));
      push(norm(train[i].low));
      push(norm(train[i].high));
      push(rect(train[i].volume));
      // RSI
      push(avg(prev, 'pos') / (avg(prev, 'pos') + avg(prev, 'neg')));
      // Stochastic
      push(k);
      push(avg(prev, 'k'));
    }
  }

  return out;
};

var label = function( curr, next ) {
  var next5 = next.slice(0, 5), next10 = next.slice(5, 10);
  var avg5 = avg(next5, 'close'), avg10 = avg(next10, 'close');
  var high5 = avg(next5, 'high'), high10 = avg(next10, 'high');
  var low5 = avg(next5, 'low'), low10 = avg(next10, 'low');
  var result = [];
  
  var writer = function(baseline){
    result.push((curr.close * 1.025 < baseline) ? 1: 0);
    result.push((curr.close * 1.015 < baseline && curr.close * 1.005 > baseline) ? 1: 0);
    result.push((curr.close * 1.005 < baseline && curr.close * 0.995 > baseline) ? 1: 0);
    result.push((curr.close * 0.995 < baseline && curr.close * 0.985 > baseline) ? 1: 0);
    result.push((curr.close * 0.975 > baseline) ? 1: 0);
  };
  
  writer(next[0].close);
  writer(avg5);
  writer(avg10);
  writer(high5);
  writer(high10);
  writer(low5);
  writer(low10);
  
  return result;
};

var hLayerSizes = function( xlen, ylen ) {
  var h = [], x = xlen / 2;
  while ( x > ylen ) {
    h.push(Math.floor(x));
    x = x / 2;
  }

  return h;
};

module.exports = exports = {
  net : null,
  train : function() {
    stock.getAll(function( err, stocks ) {
      console.log('TRAIN SET CREATION');
      async.reduce(stocks, {
        x : [],
        y : []
      }, function( labels, stock, next ) {
        console.log(stock.code, stock.title);
        if ( stock.dailyData !== undefined ) {
          var set = [];
          async.times(stock.dailyData.length - 10,
              function( index, step ) {
                var last = stock.dailyData[index];
                set.push(last);
                if ( set.length == DAYS ) {
                  var i = input(set);
                  var o = label(last, stock.dailyData.slice(index + 1,
                      index + 11));
                  labels.x.push(i);
                  labels.y.push(o);
                  set.shift();
                }
                step();
              }, function() {
                next(false, labels);
              });
        } else {
          next(false, labels);
        }
      }, function( err, labels ) {
        if ( !err && labels.x.length > 0 ) {
          var nIn = labels.x[0].length;
          var nOut = labels.y[0].length;
          console.log('TRAIN SET CREATION COMPLETE : ' + labels.x.length
              + ' x ' + nIn);
          var layers = hLayerSizes(nIn, nOut);
          console.log('LAYERS : ' + layers.join('→') + '→' + nOut);
          if ( exports.net === null ) {
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
              'epochs' : 100
            });
            console.log(new Date(), 'START TRAINING');
            exports.net.finetune({
              'lr' : 0.84,
              'epochs' : 50
            });
          } else {
            exports.net.x = labels.x;
            exports.net.y = labels.y;
            console.log(new Date(), 'START PRE_TRAINING');
            exports.net.pretrain({
              'lr' : 0.8,
              'k' : 1,
              'epochs' : 20
            });
            console.log(new Date(), 'START TRAINING');
            exports.net.finetune({
              'lr' : 0.84,
              'epochs' : 10
            });
          }

          async.each(stocks, function( item, next ) {
            stock.load(item.code, function( err, entry ) {
              entry.expect = exports.expect(entry.dailyData.slice(-DAYS));
              entry.save(function() {
                console.log('EXPECTED', entry.title);
              });
              next();
            });
          });
          console.log(new Date(), 'END TRAINING');
        } else {
          console.log('NO TRAIN DATA');
        }
      });
    });
  },
  expect : function( data ) {
    var expect = [
        0, 0, 0, 0, 0, 0, 0
    ];
    if ( data.length === DAYS && exports.net ) {
      expect = exports.net.predict([
        input(data)
      ])[0];
    }

    return expect;
  },
  DAYS : DAYS
};
