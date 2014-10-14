/**
 * ./ctrls/naverParser.js Parser set for Naver API
 */
var async = require('async');
var xml2js = require('xml2js');
var dateformat = require('dateformat');
var stock = require('../models/stock');

module.exports = {
  history : function ( str, callback ) {
    xml2js.parseString(str, function ( err, data ) {
      if ( data.protocol ) {
        data = data.protocol.chartdata[0];
        var output = {
          code : data.$.symbol,
          title : data.$.name,
          dailyData : []
        };
        console.log(data.$.name);

        async.each(data.item, function ( item, cb ) {
          var text = item.$.data.split("|");
          output.dailyData.push({
            at : text[0],
            start : Number(text[1]),
            high : Number(text[2]),
            low : Number(text[3]),
            close : Number(text[4]),
            volume : Number(text[5])
          });
          cb();
        }, function () {
          stock.init(output, callback);
        });
      } else {
        callback('Empty Parsed Result');
      }
    });
  },
  today : function ( str, callback ) {
    var data = JSON.parse(str);

    if ( data.result.areas.length > 0 ) {
      var output = {};

      async.each(data.result.areas[0].datas, function ( item, cb ) {
        output[item.cd] = {
          at : dateformat('yyyymmdd'),
          start : item.ov,
          close : item.nv,
          high : item.hv,
          low : item.lv,
          volume : item.aq,
          stat : item.ms
        }
        cb();
      }, function () {
        callback(false, output);
      });
    } else {
      callback(true);
    }
  }
};
