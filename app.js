/**
 * New node file
 */
var express = require('express');
var stylus = require('stylus');
var async = require('async');
var stock = require('./models/stock');
var brain = require('./ctrls/brain');

var schedule = require('node-schedule');
var crawler = require('./ctrls/crawler');
var numeral = require('numeral');
var dateformat = require('dateformat');

var app = express();
require('express-params').extend(app);

app.param('stock', /^[0-9a-zA-Z]+$/);
app.use(stylus.middleware({
  src : './styl',
  dest : './public'
}));
app.use('/static', express.static(__dirname + '/public'));

app.get('/', function ( req, res ) {
  stock.getAll(function ( err, items ) {
    res.render('index.jade', {
      stock : items,
      currformat : function ( curr ) {
        return numeral(curr).format('0,0');
      }
    });
  });
});

app.get('/add', function ( req, res ) {
  crawler.init(req.query.stock);
  res.redirect('/');
});

app.get('/stock/:stock', function ( req, res ) {
  brain.expect(req.params.stock, function ( base, data, output ) {
    var prev = {
      close : 0
    };
    async.each(data, function ( item, cb ) {
      item.diff = item.close - prev.close;
      prev = item;
      cb();
    }, function () {
      res.render('item.jade', {
        code : req.params.stock,
        title : base.title,
        curr : data.reverse(),
        expect : output,
        dateformat : function ( date ) {
          return dateformat(date, 'mm. dd.');
        },
        currformat : function ( number ) {
          if ( number ) {
            return '￦ ' + numeral(number).format('0,0[.]00');
          } else {
            return '-';
          }
        },
        diffformat : function ( number ) {
          if ( number ) {
            return (number > 0) ? '▲' + number : '▼' + (-number);
          } else {
            return '-';
          }
        },
        predictformat : function ( number ){
          if ( number > 0.65 ) {
            return '반드시! ('+numeral(number).format('0.0%')+')';
          } else if (number > 0.35){
            return '아마도. ('+numeral(number).format('0.0%')+')';
          } else {
            return '불가능!';
          }
        }
      });
    });
  })
});

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [ new schedule.Range(1, 5) ];
rule.hour = [ new schedule.Range(8, 16) ];
rule.minute = [ new schedule.Range(0, 59, 3) ];

schedule.scheduleJob(rule, function () {
  crawler.today();
});

rule = new schedule.RecurrenceRule();
rule.dayOfWeek = 6;
rule.hour = 0;
rule.minute = 0;

schedule.scheduleJob(rule, function () {
  brain.train();
});

app.listen(3000, function () {
  console.log('APP LISTEN AT PORT 3000');
  brain.train();
});