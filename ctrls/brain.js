/**
 * New node file
 */
var brain = require('dnn');
var stock = require('../models/stock');
var async = require('async');

const DAYS = 10 + 15;

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
      out.push(0.);
    } else if ( value > 1 ) {
      out.push(1.);
    } else if ( value < -1 ) {
      out.push(-1.);
    } else {
      out.push(value);
    }
  };
  var norm = function( value ) {
    if ( interval.high === interval.low ) {
      return 0.;
    } else {
      return (value - interval.low) / (interval.high - interval.low) * 2. - 1.;
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

    if ( prev.length === 15 ) {
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
        push(-1);
      }else{
        push(0);
      }
      
      // Volume
      push ((item.volume > avg(prev, 'volume')) ? 1. : -1.);
      
      // RSI
      item.RSI = avg(prev, 'pos') / (avg(prev, 'pos') + avg(prev, 'neg'));
      if ( (item.RSI < 0.3 && item.RSI < yesterday.RSI && item.RSI > min(prev, 'RSI')) || (item.RSI > 0.5 && yesterday.RSI < 0.5) ){
        push(1);
      }else if ( (item.RSI > 0.7 && item.RSI > yesterday.RSI && item.RSI < max(prev, 'RSI')) || (item.RSI < 0.5 && yesterday.RSI > 0.5) ){
        push(-1);
      }else{
        push(0);
      }
      
      if (item.RSI < 0.3){
        push(1);
      }else if (item.RSI > 0.7){
        push(-1);
      }else{
        push(0);
      }
      
      // Stochastic-K
      item.stochK = (item.close - min(prev, 'low')) / (max(prev, 'high') - min(prev, 'low'));
      // Stochastic-D
      item.stochD = avg(prev, 'stochK');
      
      if ( item.stochD > 0.8 || (item.stochD < item.stochK && yesterday.stochD > yesterday.stochK) ){
        push(-1);
      }else if ( item.stochD < 0.2 || (item.stochD > item.stochK && yesterday.stochD < yesterday.stochK) ){
        push(1);
      }else{
        push(0);
      }
      
      if (item.stochD < 0.2 && item.stochD < yesterday.stochD && item.stochD > min(prev, 'stochD')){
        push(1);
      }else if (item.stochD > 0.8 && item.stochD > yesterday.stochD && item.stochD < max(prev, 'stochD')){
        push(-1);
      }else{
        push(0);
      }
      
      // CCI[-1, 1]
      item.CCI = (item.close - item.ma15) / (std(prev, 'close') * 1.5);
      
      if ( item.CCI > 1 || (item.CCI < 0 && yesterday.CCI > 0) ){
        push(-1);
      }else if ( item.CCI < -1 || (item.CCI > 0 && yesterday.CCI < 0) ){
        push(1);
      }else{
        push(0);
      }
      
      if (item.CCI < -1 && item.CCI < yesterday.CCI && item.CCI > min(prev, 'CCI')){
        push(1);
      }else if (item.CCI > 1 && item.CCI > yesterday.CCI && item.CCI < max(prev, 'CCI')){
        push(-1);
      }else{
        push(0);
      }
      
      // ROC[-1, 1]
      item.ROC = (item.close - prev[0].close) / (prev[0].close);
      
      if ( item.ROC > 0 && yesterday.ROC < 0 ) {
        push(1);
      }else if ( item.ROC < 0 && yesterday.ROC > 0 ) {
        push(-1);
      }else{
        push(0);
      }
      
      if (item.ROC < yesterday.ROC && item.ROC > min(prev, 'ROC')){
        push(1);
      }else if (item.ROC > yesterday.ROC && item.ROC < max(prev, 'ROC')){
        push(-1);
      }else{
        push(0);
      }
      
      // DMI/100
      item.DMpos = (item.upMove > item.downMove && item.upMove > 0) ? item.upMove : 0;
      item.DMneg = (item.upMove < item.downMove && item.downMove > 0) ? item.downMove : 0;
      item.DIpos = ema(prev, 'DMpos') / (avg(prev, 'TR') * 100);
      item.DIneg = ema(prev, 'DMneg') / (avg(prev, 'TR') * 100);
      item.DIdiff = Math.abs(item.DIpos - item.DIneg);
      
      if ( item.DIneg < item.DIpos && (yesterday.DIneg > yesterday.DIpos || yesterday.DIdiff < item.DIdiff) ){
        push(1);
      }else if ( item.DIneg > item.DIpos && (yesterday.DIneg < yesterday.DIpos || yesterday.DIdiff > yesterday.DIdiff) ){
        push(-1);
      }else{
        push(0);
      }
      
      if ( yesterday.DIdiff < item.DIdiff && yesterday.DIdiff === max(prev, 'DIdiff') ){
        if ( item.DIneg < item.DIpos ){
          push(-1);
        }else {
          push(1);
        }
      }else{
        push(0);
      }
      
      // MFI[-1, 1]
      item.MFI = avg(prev, 'MFpos') / (avg(prev, 'MFpos') + avg(prev, 'MFneg')) * 2. - 1.;
      
      if ( item.MFI < 0.2 ) {
        push(1);
      }else if ( item.MFI > 0.8 ) {
        push(-1);
      }else{
        push(0);
      }
      
      if ( item.MFI < 0.2 && item.MFI < yesterday.MFI && item.MFI > min(prev, 'MFI')){
        push(1);
      }else if ( item.MFI > 0.8 && item.MFI > yesterday.MFI && item.MFI < max(prev, 'MFI')){
        push(-1);
      }else{
        push(0);
      }
      
      push(item.close > item.start ? 1 : -1);
      push(item.close > yesterday.close ? 1 : -1);
      push(item.close > item.typical ? 1 : -1);
      push(item.high > yesterday.high ? 1 : -1);
      push(item.low < yesterday.low ? 1 : -1);
      
      prev.shift();
    }
  }

  return out;
};

var label = function( curr, next ) {
  var result = [];
  
  var writer = function(key, upmove){
    var today = curr[key];
    for ( var i = 0; i < next.length; i ++ ){
      var tomorrow = next[i][key];
      result.push((tomorrow > today) ? upmove : -upmove);
      today = tomorrow;
    }
  };
  
  writer('close', 1);
  writer('high', 1);
  writer('low', -1);
  
  return result;
};

var hLayerSizes = function( xlen, ylen ) {
  var h = [];
  h.push(Math.ceil( (xlen * 2 + ylen) / 3 ));
  h.push(Math.floor( (xlen + ylen * 2) / 3 ));

  return h;
};

var trainAndExpect = function( err, labels ) {
  if ( labels.x.length > 0 ) {
    var nIn = labels.x[0].length;
    var nOut = labels.y[0].length;
    console.log('TRAIN SET CREATION COMPLETE : ' + labels.x.length
      + ' x ' + nIn);
    var layers = hLayerSizes(nIn, nOut);
    console.log('LAYERS : ' + layers.join('→') + '→' + nOut);
    if ( !exports.net ) {
      exports.net = new brain.DBN({
        'input' : labels.x,
        'label' : labels.y,
        'n_ins' : nIn,
        'n_outs' : nOut,
        'hidden_layer_sizes' : layers
      });
      //exports.net.set('log level', 0);
      //console.log(new Date(), 'START PRE_TRAINING (NEW)');
      exports.net.pretrain({
        'lr' : 0.8,
        'k' : 1,
        'epochs' : 100
      });
      //console.log(new Date(), 'START TRAINING');
      exports.net.finetune({
        'lr' : 0.84,
        'epochs' : 50
      });
    } else {
      exports.net.x = labels.x;
      exports.net.y = labels.y;
      //console.log(new Date(), 'START PRE_TRAINING');
      exports.net.pretrain({
        'lr' : 0.8,
        'k' : 1,
        'epochs' : 20
      });
      //console.log(new Date(), 'START TRAINING');
      exports.net.finetune({
        'lr' : 0.84,
        'epochs' : 10
      });
    }
    
    async.each(labels.codes, function(code, next){
      stock.load(code, function( err, entry ) {
        entry.expect = exports.expect(entry);
        entry.save(function() {
          console.log('EXPECTED', entry.title);
          next();
        });
      });
    });
    console.log(new Date(), 'END TRAINING');
  } else {
    console.log('NO TRAIN DATA');
  }
};

var trainEntry = function( labels, item, next ) {
  labels.codes.push(item.code);
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
};

module.exports = exports = {
  net : undefined,
  train : function() {
    stock.getAll(function( err, stocks ) {
      console.log('TRAIN SET CREATION');
      async.reduce(stocks, {
        x: [],
        y: [],
        codes: [],
      }, trainEntry, trainAndExpect);
    });
  },
  expect : function( entry ) {
    var data = entry.dailyData.slice(-DAYS);
    var expect = [];
    
    if ( data.length === DAYS ){
      if ( typeof exports.net !== 'undefined' ) {
        expect = exports.net.predict([
          input(data)
        ])[0];
      }
    }

    return expect;
  }
};
