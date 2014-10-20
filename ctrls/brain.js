/**
 * New node file
 */
var brain = require('dnn');
var stock = require('../models/stock');
var async = require('async');

const
DAYS = 10 + 15;

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

var ema = function( array, key ){
  var sum = array[0][key], rate = 0.8;
  for ( var i = 1; i < array.length; i++ ) {
    sum = array[i][key] * rate + (1 - rate) * sum;
  }
  return sum;
};

var input = function( train ) {
  var out = [], prev = [];
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
    var yesterday = train[i - 1];
    
    var change = train[i].close - yesterday.close;
    if ( change > 0 ) {
      item.pos = change;
      item.neg = 0;
    } else {
      item.neg = -change;
      item.pos = 0;
    }
    item.TR = Math.max(item.high - item.low, 
      Math.abs(item.high - yesterday.close),
      Math.abs(item.low - yesterday.close));
    item.upMove = item.high - yesterday.high;
    item.downMove = yesterday.low - item.low;
    item.typical = (item.high + item.low + item.close) / 3;
    item.MFpos = (item.typical > yesterday.typical) ? item.typical * item.volume : 0;
    item.MFneg = (item.typical < yesterday.typical) ? item.typical * item.volume : 0;
    prev.push(item);

    if ( prev.length === 15 ) {
      // MA
      item.ma15 = avg(prev, 'close');
      item.ma7 = avg(prev.slice(-7), 'close');
      item.MACD = item.ma15 - item.ma7;
      item.MACDsign = (item.MACD > 0) ? 1 : 0;
      item.MACDratio = Math.abs(item.MACD - yesterday.MACD) / yesterday.MACD;
      push(item.MACDsign);
      push(item.MACDratio);
      // Volume
      item.VOLratio = (avg(prev.slice(-5), 'volume') > avg(prev, 'volume')) ? 1 : 0;
      
      // RSI
      item.RSI = avg(prev, 'pos') / (avg(prev, 'pos') + avg(prev, 'neg'));
      push(item.RSI);
      // Stochastic-K
      item.stochK = (item.close - min(prev, 'low')) / (max(prev, 'high') - min(prev, 'low'));
      push(item.stochK);
      // Stochastic-D
      item.stochD = avg(prev, 'stochK');
      push(item.stockD);
      // CCI[0,1]
      item.CCI = (item.close - item.ma15) / (std(prev, 'close') * 3) + 0.5;
      push(item.CCI);
      // ROC[0,1]
      item.ROC = (item.close - prev[0].close) / (prev[0].close * 2) + 0.5;
      push(item.ROC);
      // DMI/100
      item.DMpos = (item.upMove > item.downMove && item.upMove > 0) ? item.upMove : 0;
      item.DMneg = (item.upMove < item.downMove && item.downMove > 0) ? item.downMove : 0;
      item.DIpos = ema(prev, 'DMpos') / (avg(prev, 'TR') * 100);
      item.DIneg = ema(prev, 'DMneg') / (avg(prev, 'TR') * 100);
      push(item.DIpos);
      push(item.DIneg);
      // MFI
      item.MFI = avg(prev, 'MFpos') / (avg(prev, 'MFpos') + avg(prev, 'MFneg'));
      push(item.MFI);
      
      
      prev.shift();
    }
  }

  return out;
};

var label = function( curr, next ) {
  var result = [];
  
  var writer = function(key){
    var prev = curr[key];
    for ( var i = 0; i < next.length; i ++ ){
      var tomorrow = next[i][key];
      result.push((tomorrow > prev) ? 1 : 0);
      prev = tomorrow;
    }
  };
  
  writer('close');
  writer('high');
  writer('low');
  
  return result;
};

var hLayerSizes = function( xlen, ylen ) {
  var h = [], x = xlen - 20;
  while ( x > ylen ) {
    h.push(Math.floor(x));
    x = x - 20;
  }

  return h;
};

var trainAndExpect = function( code, labels ) {
  if ( labels.x.length > 0 ) {
    var nIn = labels.x[0].length;
    var nOut = labels.y[0].length;
    console.log('TRAIN SET CREATION COMPLETE : ' + labels.x.length
        + ' x ' + nIn);
    var layers = hLayerSizes(nIn, nOut);
    console.log('LAYERS : ' + layers.join('→') + '→' + nOut);
    if ( !exports.net[code] ) {
      exports.net[code] = new brain.CDBN({
        'input' : labels.x,
        'label' : labels.y,
        'n_ins' : nIn,
        'n_outs' : nOut,
        'hidden_layer_sizes' : layers
      });
      exports.net[code].set('log level', 1);
      console.log(new Date(), 'START PRE_TRAINING (NEW)');
      exports.net[code].pretrain({
        'lr' : 0.8,
        'k' : 1,
        'epochs' : 100
      });
      console.log(new Date(), 'START TRAINING');
      exports.net[code].finetune({
        'lr' : 0.84,
        'epochs' : 50
      });
    } else {
      exports.net[code].x = labels.x;
      exports.net[code].y = labels.y;
      console.log(new Date(), 'START PRE_TRAINING');
      exports.net[code].pretrain({
        'lr' : 0.8,
        'k' : 1,
        'epochs' : 20
      });
      console.log(new Date(), 'START TRAINING');
      exports.net[code].finetune({
        'lr' : 0.84,
        'epochs' : 10
      });
    }

    stock.load(code, function( err, entry ) {
      entry.expect = exports.expect(entry, true);
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
    async.times(item.dailyData.length - 10,
        function( index, step ) {
          var last = item.dailyData[index];
          set.push(last);
          if ( set.length == DAYS ) {
            var i = input(set, avgVol, stdVol);
            var o = label(last, item.dailyData.slice(index + 1,
                index + 11));
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
    next();
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
  expect : function( entry, notTrain ) {
    var data = entry.dailyData.slice(-DAYS);
    var code = entry.code;
    var expect = [];
    
    if ( data.length === DAYS ){
      if ( typeof exports.net[code] !== 'undefined' ) {
        expect = exports.net[code].predict([
          input(data)
        ])[0];
      }else if ( !notTrain ){
        console.log('NO TRAINED ENTRY FOR', code);
      }
    }

    return expect;
  }
};
