/**
 * ./ctrls/crawler.js Crawling Naver Finance Data.
 */

var http = require('http');
var parser = require('./naverParser');
var brain = require('./brain');
var stock = require('../models/stock');
var async = require('async');
var Iconv = require('iconv').Iconv;
var iconv = new Iconv('euc-kr', 'utf-8//translit//ignore');

module.exports = {
  init : function( code ) {
    var url = 'http://fchart.stock.naver.com/sise.nhn?timeframe=day&count=3000&requestType=0&symbol='
        + code;

    var handler = function( text ) {
      parser.history(text);
    };

    http.get(url, function( res ) {
      var str = '';
      res.setEncoding('binary');
      res.on('data', function( text ) {
        str += text;
      });
      res.on('end', function() {
        var searchResultBin = new Buffer(str, 'binary');
        handler(iconv.convert(searchResultBin).toString('utf-8'));
      });
    });
  },
  today : function() {
    stock
        .getCodes(function( err, stocks ) {
          if ( !err ) {
            var url = 'http://polling.finance.naver.com/api/realtime.nhn?query=SERVICE_RECENT_ITEM:'
                + stocks.join(',');
            var save = function( err, output ) {
              async.each(Object.keys(output), function( key, cb ) {
                var item = output[key];
                stock.load(key, function( err, entry ) {
                  if ( !err && entry !== null ) {
                    console.log('CRAWLED', key, entry.title);

                    var data = entry.dailyData;
                    if ( data[data.length - 1].at !== item.at ) {
                      data.push(item);
                    } else {
                      data[data.length - 1].start = item.start;
                      data[data.length - 1].close = item.close;
                      data[data.length - 1].high = item.high;
                      data[data.length - 1].low = item.low;
                      data[data.length - 1].volume = item.volume;
                    }
                    entry.expect = brain.expect(data.slice(-brain.DAYS));

                    entry.save(function(err){
                      if(err){
                        console.log(err);
                      }
                    });
                  }
                });
                cb();
              }, function() {
              });
            };

            http.get(url, function( res ) {
              var str = '';
              res.on('data', function( text ) {
                str += text;
              });
              res.on('end', function() {
                parser.today(str, save);
              });
            });
          }
        });
  }
}