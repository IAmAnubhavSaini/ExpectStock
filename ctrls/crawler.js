/**
 * ./ctrls/crawler.js Crawling Naver Finance Data.
 */

var http = require('http');
var parser = require('./naverParser');
var stock = require('../models/stock');
var dateFormat = require('dateformat');
var async = require('async');
var Iconv = require('iconv').Iconv;
var iconv = new Iconv('euc-kr', 'utf-8//translit//ignore');

module.exports = {
  init : function ( code ) {
    var url = 'http://fchart.stock.naver.com/sise.nhn?timeframe=day&count=3000&requestType=0&symbol='
        + code;
    
    var handler = function ( text ) {
      parser.history(text);
    };

    http.get(url, function ( res ) {
      var str = '';
      res.setEncoding('binary');
      res.on('data', function ( text ) {
        str += text;
      });
      res.on('end', function(){
        var searchResultBin = new Buffer(str, 'binary');
        handler(iconv.convert(searchResultBin).toString('utf-8'));
      });
    });
  },
  today : function () {
    stock
        .getCodes(function ( err, stocks ) {
          if ( !err ) {
            var url = 'http://polling.finance.naver.com/api/realtime.nhn?query=SERVICE_RECENT_ITEM:'
                + stocks.join(',');
            var save = function ( err, output ) {
              async.each(Object.keys(output), function ( key, cb ) {
                var item = output[key];
                parser.get(key, function ( err, stock ) {
                  if ( !err && stock !== null ) {
                    var data = stock.dailyData;
                    if ( data[data.length - 1].stat === 'CLOSE'
                        && item.stat !== 'CLOSE' ) {
                      data.push(item);
                    } else if ( item.stat.match(/OPEN/) !== null ) {
                      data[data.length - 1] = item;
                    }

                    stock.save();
                  }
                });
                cb();
              }, function () {
              });
            };

            http.get(url, function ( res ) {
              var str = '';
              res.on('data', function ( text ) {
                str += text;
              });
              res.on('end', function(){
                parser.today(str, save);
              });
            });
          }
        });
  }
}