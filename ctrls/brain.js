/**
 * New node file
 */
var brain = require('brain');
var stock = require('../models/stock');
var async = require('async');
var trader = require('./trader');

const DAYS = 15 + 20;

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
  var interval = {
    high : max(train, 'high'),
    low : min(train, 'low')
  };
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
  var norm = function( value ) {
    if ( interval.high === interval.low ) {
      return 0.5;
    } else {
      return (value - interval.low) / (interval.high - interval.low);
    }
  };
  
  for ( var i = 1; i < train.length; i++ ) {
    var item = train[i];
    var yesterday = train[i - 1];
    
    var change = train[i].close - yesterday.close;
    if ( change > 0 ) {
      item.pos = change;
      item.neg = 0.;
    } else {
      item.neg = -change;
      item.pos = 0.;
    }
    item.TR = Math.max(item.high - item.low, 
      Math.abs(item.high - yesterday.close),
      Math.abs(item.low - yesterday.close));
    item.upMove = item.high - yesterday.high;
    item.downMove = yesterday.low - item.low;
    item.typical = (item.high + item.low + item.close) / 3.;
    item.MFpos = (item.typical > yesterday.typical) ? item.typical * item.volume : 0.;
    item.MFneg = (item.typical < yesterday.typical) ? item.typical * item.volume : 0.;
    prev.push(item);

    if ( prev.length === 20 ) {
      // MA
      item.ma15 = avg(prev, 'close');
      item.ma7 = avg(prev.slice(-7), 'close');
      item.MACD = item.ma15 - item.ma7;
      item.MACDsignal = avg(prev, 'MACD');
      if( (item.MACD > item.MACDsignal && yesterday.MACD < yesterday.MACDsignal)
        ||(item.MACD > 0 && yesterday.MACD < 0) ){
        push(1);
      }else if ( (item.MACD < item.MACDsignal && yesterday.MACD > yesterday.MACDsignal)
        ||(item.MACD < 0 && yesterday.MACD > 0) ){
        push(0);
      }else{
        push(0.5);
      }
      
      // Volume
      push ((item.volume > avg(prev, 'volume')) ? 1 : 0);
      
      // RSI
      item.RSI = avg(prev, 'pos') / (avg(prev, 'pos') + avg(prev, 'neg'));
      if ( (item.RSI < 0.3 && item.RSI < yesterday.RSI && item.RSI > min(prev, 'RSI')) || (item.RSI > 0.5 && yesterday.RSI < 0.5) ){
        push(1);
      }else if ( (item.RSI > 0.7 && item.RSI > yesterday.RSI && item.RSI < max(prev, 'RSI')) || (item.RSI < 0.5 && yesterday.RSI > 0.5) ){
        push(0);
      }else if (item.RSI < 0.3){
        push(0.75);
      }else if (item.RSI > 0.7){
        push(0.25);
      }else{
        push(0.5);
      }
      
      // Stochastic-K
      item.stochK = (item.close - min(prev, 'low')) / (max(prev, 'high') - min(prev, 'low'));
      // Stochastic-D
      item.stochD = avg(prev, 'stochK');
      
      if (item.stochD < 0.2 && item.stochD < yesterday.stochD && item.stochD > min(prev, 'stochD')){
        push(1);
      }else if (item.stochD > 0.8 && item.stochD > yesterday.stochD && item.stochD < max(prev, 'stochD')){
        push(0);
      }else if ( item.stochD > 0.8 || (item.stochD < item.stochK && yesterday.stochD > yesterday.stochK) ){
        push(0.25);
      }else if ( item.stochD < 0.2 || (item.stochD > item.stochK && yesterday.stochD < yesterday.stochK) ){
        push(0.75);
      }else{
        push(0.5);
      }
      
      // CCI[-1, 1]
      item.CCI = (item.close - item.ma15) / (std(prev, 'close') * 1.5);
      
      if (item.CCI < -1 && item.CCI < yesterday.CCI && item.CCI > min(prev, 'CCI')){
        push(1);
      }else if (item.CCI > 1 && item.CCI > yesterday.CCI && item.CCI < max(prev, 'CCI')){
        push(0);
      }else if ( item.CCI > 1 || (item.CCI < 0 && yesterday.CCI > 0) ){
        push(0.25);
      }else if ( item.CCI < -1 || (item.CCI > 0 && yesterday.CCI < 0) ){
        push(0.75);
      }else{
        push(0.5);
      }
      
      // ROC[-1, 1]
      item.ROC = (item.close - prev[0].close) / (prev[0].close);
      
      if (item.ROC < yesterday.ROC && item.ROC > min(prev, 'ROC')){
        push(1);
      }else if (item.ROC > yesterday.ROC && item.ROC < max(prev, 'ROC')){
        push(0);
      }else if ( item.ROC > 0 && yesterday.ROC < 0 ) {
        push(0.75);
      }else if ( item.ROC < 0 && yesterday.ROC > 0 ) {
        push(0.25);
      }else{
        push(0.5);
      }
      
      // DMI/100
      item.DMpos = (item.upMove > item.downMove && item.upMove > 0) ? item.upMove : 0;
      item.DMneg = (item.upMove < item.downMove && item.downMove > 0) ? item.downMove : 0;
      item.DIpos = ema(prev, 'DMpos') / (avg(prev, 'TR') * 100);
      item.DIneg = ema(prev, 'DMneg') / (avg(prev, 'TR') * 100);
      item.DIdiff = Math.abs(item.DIpos - item.DIneg);
      
      if ( yesterday.DIdiff < item.DIdiff && yesterday.DIdiff === max(prev, 'DIdiff') ){
        if ( item.DIneg < item.DIpos ){
          push(0);
        }else {
          push(1);
        }
      }else if ( item.DIneg < item.DIpos && (yesterday.DIneg > yesterday.DIpos || yesterday.DIdiff < item.DIdiff) ){
        push(0.75);
      }else if ( item.DIneg > item.DIpos && (yesterday.DIneg < yesterday.DIpos || yesterday.DIdiff > yesterday.DIdiff) ){
        push(0.25);
      }else{
        push(0.5);
      }
      
      // MFI[-1, 1]
      item.MFI = avg(prev, 'MFpos') / (avg(prev, 'MFpos') + avg(prev, 'MFneg')) * 2. - 1.;
      
      if ( item.MFI < 0.2 && item.MFI < yesterday.MFI && item.MFI > min(prev, 'MFI')){
        push(1);
      }else if ( item.MFI > 0.8 && item.MFI > yesterday.MFI && item.MFI < max(prev, 'MFI')){
        push(0);
      }else if ( item.MFI < 0.2 ) {
        push(0.75);
      }else if ( item.MFI > 0.8 ) {
        push(0.25);
      }else{
        push(0.5);
      }
      
      push(norm(item.close));
      push(norm(item.high));
      push(norm(item.low));
      push(norm(item.start));
      
      prev.shift();
    }
  }

  return out;
};

var label = function( curr, next ) {
  var result = [];
  var step = 10;
  if( curr.close > 500000 ){
    step = 1000;
  }else if ( curr.close > 100000 ){
    step = 500;
  }else if ( curr.close > 50000 ){
    step = 100;
  }else if ( curr.close > 10000 ){ 
    step = 50;
  }
  step *= 2;
  
  var steps = function(key, fn){
    var peak = fn(next, key);
    var diff = Math.abs(peak - curr[key]);
    for ( var i = 0; i < next.length; i ++ ){
      if ( diff > step * i ){
        result.push( 1 );
      }else{
        result.push( 0 );
      }
    }
  };
  
  var days = function(key){
    var upper = curr[key] + step, lower = curr[key] - step;
    var up = 0, st = 0, dn = 0;
    for ( var i = 0; i < next.length; i ++ ){
      if ( next[i][key] > upper ){
        up++;
      }else if ( next[i][key] < lower ){
        dn++;
      }else{
        st++;
      }
    }
    
    for ( var i = 0; i < next.length; i++ ){
      if ( i < up ){
        result.push(1);
      }else if ( i < up + st ){
        result.push(0.5);
      }else{
        result.push(0);
      }
    }
  };
  
  days('close');
  steps('high', max);
  steps('low', min);
  
  return result;
};

var hLayerSizes = function( xlen, ylen ) {
  var h = [];
  h.push(Math.floor( (xlen * 3 + ylen) / 4 ));
  h.push(Math.floor( (xlen + ylen) / 2 ));
  h.push(Math.floor( (xlen + ylen * 3) / 4 ));

  return h;
};

var trainAndExpect = function( labels, callback ) {
  if ( labels.io.length > 0 ) {
    var nIn = labels.io[0].input.length;
    var nOut = labels.io[0].output.length;
    var layers = hLayerSizes(nIn, nOut);
    var code = labels.code;
    
    console.log('TRAIN : ' + labels.io.length + ' x ' + nIn + '→' + layers.join('→') + '→' + nOut);
    if ( !exports.net[code] ) {
      exports.net[code] = new brain.NeuralNetwork({
        hiddenLayers: layers,
        learningRate: 0.3
      });
      exports.net[code]._trOption = {
        errorThresh: 0.01,
        iterations: 50,
        log: true,
        logPeriod: 10
      };
    }
    console.log('PARAM', exports.net[code]._trOption);
    var trainResult = exports.net[code].train(labels.io, exports.net[code]._trOption);
    exports.net[code]._trOption.errorThresh = Math.min(exports.net[code]._trOption.errorThresh, trainResult.error * 0.8);
    exports.net[code]._trOption.iterations = Math.max(Math.min(trainResult.iterations * 2, 200), 50);
    
    stock.load(code, function( err, entry ) {
      entry.expect = exports.expect(entry);
      entry.save(function() {
        console.log('EXPECTED', entry.title);
        callback();
      });
    });
    console.log(new Date(), 'END TRAINING');
  } else {
    console.log('NO TRAIN DATA');
    callback();
  }
};

var trainEntry = function( item, next ) {
  var labels = {
    io: [],
    code: item.code,
  };
  console.log(item.code, item.title);
  if ( item.dailyData !== undefined ) {
    var set = [];
    async.times(item.dailyData.length - 10,
      function( index, step ) {
        var last = item.dailyData[index];
        set.push(last);
        if ( set.length == DAYS ) {
          var i = input(set);
          var o = label(last, item.dailyData.slice(index + 1,
              index + 11));
          labels.io.push({input: i, output: o});
          set.shift();
        }
        step();
      }, function() {
        trainAndExpect(labels, next);
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
      async.each(stocks, trainEntry, trader.trade);
    });
  },
  expect : function( entry ) {
    var data = entry.dailyData.slice(-DAYS);
    var code = entry.code;
    var expect = [];
    
    if ( data.length === DAYS ){
      if ( typeof exports.net[code] !== 'undefined' ) {
        expect = exports.net[code].run(input(data));
        for(var i=0; i < expect.length; i++){
          expect[i] = expect[i] * 2 - 1;
        }
      }
    }

    return expect;
  }
};
