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
  stock.getAll(function ( items ) {
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
        progress : numeral(base.progress / data.length).format('0.0%'),
        curr : data.reverse(),
        expect : output,
        dateformat : function ( date ) {
          return dateformat(date, 'mm. dd.');
        },
        currformat : function ( number ) {
          return '￦ ' + numeral(number).format('0,0[.]00');
        },
        diffformat : function ( number ) {
          return (number > 0) ? '▲' + number : '▼' + (-number);
        }
      });
    });
  })
});

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [ new schedule.Range(1, 5) ];
rule.hour = [ new schedule.Range(8, 16) ];
rule.minute = 30;

schedule.scheduleJob(rule, function () {
  crawler.today();
});

rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [ new schedule.Range(1, 5) ];
rule.hour = 17;
rule.minute = 30;

schedule.scheduleJob(rule, function () {
  brain.train();
});

app.listen(3000, function () {
  console.log('APP LISTEN AT PORT 3000');
  brain.train();
});