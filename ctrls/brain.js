/**
 * New node file
 */
var brain = require('dnn');
var stock = require('../models/stock');
var async = require('async');

const
DAYS = 10 + 18;

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

var input = function( train, avgVol, stdVol ) {
  var set = {
    high : max(train, 'high'),
    low : min(train, 'low')
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
    var upper = avgVol + 2 * stdVol;
    var lower = avgVol - 2 * stdVol;
    if ( value > upper ) {
      return 1;
    } else if ( value < lower ){
      return 0;
    } else {
      return (value - lower) / (upper - lower);
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

    if ( prev.length > 15 ) {
      prev.shift();
    }

    if ( i > 17 ) {
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
  var next5 = next.slice(5, 10), next10 = next.slice(10, 20);
  var avg5 = avg(next5, 'close'), avg10 = avg(next10, 'close');
  var high5 = max(next5, 'high'), high10 = max(next10, 'high');
  var low5 = min(next5, 'low'), low10 = min(next10, 'low');
  var result = [];
  
  var writer = function(baseline){
    result.push((curr.close * 1.03 < baseline) ? 1: 0);
    result.push((curr.close * 1.03 > baseline && curr.close * 1.01 < baseline) ? 1: 0);
    result.push((curr.close * 1.01 > baseline && curr.close * 0.99 < baseline) ? 1: 0);
    result.push((curr.close * 0.99 > baseline && curr.close * 0.97 < baseline) ? 1: 0);
    result.push((curr.close * 0.97 > baseline) ? 1: 0);
  };
  
  writer(next[0].close);
  writer(avg5);
  writer(high5);
  writer(low5);
  writer(avg10);
  writer(high10);
  writer(low10);
  
  return result;
};

var hLayerSizes = function( xlen, ylen ) {
  var h = [], x = xlen - 15;
  while ( x > ylen ) {
    h.push(Math.floor(x));
    x = x - 15;
  }

  return h;
};

var trainAndExpect = function( code, labels ) {
  var net = exports.net[code];
  if ( labels.x.length > 0 ) {
    var nIn = labels.x[0].length;
    var nOut = labels.y[0].length;
    console.log('TRAIN SET CREATION COMPLETE : ' + labels.x.length
        + ' x ' + nIn);
    var layers = hLayerSizes(nIn, nOut);
    console.log('LAYERS : ' + layers.join('→') + '→' + nOut);
    if ( !net ) {
      net = exports.net[code] = new brain.CDBN({
        'input' : labels.x,
        'label' : labels.y,
        'n_ins' : nIn,
        'n_outs' : nOut,
        'hidden_layer_sizes' : layers
      });
      net.set('log level', 1);
      console.log(new Date(), 'START PRE_TRAINING (NEW)');
      net.pretrain({
        'lr' : 0.8,
        'k' : 1,
        'epochs' : 100
      });
      console.log(new Date(), 'START TRAINING');
      net.finetune({
        'lr' : 0.84,
        'epochs' : 50
      });
    } else {
      net.x = labels.x;
      net.y = labels.y;
      console.log(new Date(), 'START PRE_TRAINING');
      net.pretrain({
        'lr' : 0.8,
        'k' : 1,
        'epochs' : 20
      });
      console.log(new Date(), 'START TRAINING');
      net.finetune({
        'lr' : 0.84,
        'epochs' : 10
      });
    }

    stock.load(code, function( err, entry ) {
      exports.expect(entry);
      entry.save(function() {
        console.log('EXPECTED', entry.title);
      });
    });
    console.log(new Date(), 'END TRAINING');
  } else {
    console.log('NO TRAIN DATA');
  }
};

var trainEntry = function( item, next ) {
  console.log(item.code, item.title);
  var labels = {
      x: [],
      y: []
  };
  
  if ( item.dailyData !== undefined ) {
    var set = [];
    var avgVol = avg(item.dailyData, 'volume');
    var stdVol = std(item.dailyData, 'volume');
    async.times(item.dailyData.length - 20,
        function( index, step ) {
          var last = item.dailyData[index];
          set.push(last);
          if ( set.length == DAYS ) {
            var i = input(set, avgVol, stdVol);
            var o = label(last, item.dailyData.slice(index + 1,
                index + 21));
            labels.x.push(i);
            labels.y.push(o);
            set.shift();
          }
          step();
        }, function() {
          trainAndExpect(item.code, labels);
          next();
        });
  } else {
    next(false, labels);
  }
};

module.exports = exports = {
  net : {},
  train : function() {
    stock.getAll(function( err, stocks ) {
      console.log('TRAIN SET CREATION');
      async.eachSeries(stocks, trainEntry);
    });
  },
  expect : function( entry ) {
    var data = entry.dailyData.slice(-DAYS);
    var code = entry.code;
    var expect = [
        0, 0, 0, 0, 0
    ];
    
    if ( data.length === DAYS){
      if ( !exports.net[code] ) {
        entry.expect = exports.net[code].predict([
          input(data)
        ])[0];
      }else{
        trainEntry(entry, function(){
          console.log('TRAINING END', entry.code);
        });
      }
    }

    return entry;
  }
};
