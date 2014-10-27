var stock = require('../models/stock');
var async = require('async');

var index = function(array, start, end, threshold){
  for( var i = start; i < end; i ++){
    if ( array[i] < threshold ){
      return i - 1;
    }
  }
  return end - 1;
};

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

module.exports = exports = {
  trade: function(){
    stock.getCodes(function(err, codes){
      async.each(codes, function(code, next){
        stock.load(code, function(err, item){
          console.log('TRADE', item.title);
          if(!err){
            if ( typeof item.balance === 'undefined' ){
              item.balance = 1000000;
              item.amount = 0;
              item.trade = [];
              item.thr = {};
            }
            
            var step = 10;
            var curr = item.dailyData[item.dailyData.length - 1];
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
            
            if ( typeof item.thr !== 'undefined' && typeof item.thr.buy !== 'undefined' ){
              var week = item.dailyData.slice(-5);
              var high = max(week, 'high');
              var low = min(week, 'low');
              
              if ( item.trade.length > 0 && high > item.thr.sell && item.thr.updays < 5 ){
                if ( Math.random() > 0.3 ){
                  var prev = item.trade.shift();
                  console.log('SELL', prev.price,'x',prev.amount, 'AT', high);
                  item.balance += (high - prev.price) * prev.amount;
                  item.amount -= prev.amount;
                }
              }
              
              if ( low < item.thr.buy && item.thr.updays > 5 ){
                var amount = item.thr.updays;
                if ( low * amount < item.balance && Math.random() > 0.3 ){
                  console.log('BUY', low,'x',amount);
                  item.balance -= low * amount;
                  item.amount += amount;
                  item.trade.push({
                    price: low,
                    amount: amount
                  });
                }
              }
            }
            
            if ( item.expect.length > 0 ){
              var buyamount = index(item.expect, 0, 10, 0);
              var sell = index(item.expect, 10, 20, 0.5) - 10;
              var buy = index(item.expect, 20, 30, 0.5) - 20;
              
              item.thr = {};
              item.thr.updays = buyamount;
              item.thr.sell = curr.high + step * sell;
              item.thr.buy = curr.low - step * buy;
              console.log('SET THR', item.thr);
            }
            
            item.save(function(err){
              if(err){
                console.log(err);
              }
              next();
            });
          }else{
            console.log(err);
            next();
          }
        });
      });
    });
  }
};