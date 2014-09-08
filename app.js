/**
 * New node file
 */
var express = require('express');
var stylus = require('stylus');
var stock = require('./models/stock');
var brain = require('./ctrls/brain');

var schedule = require('node-schedule');
var crawler = require('./ctrls/crawler');

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
      stock : items
    });
  });
});

app.get('/add', function ( req, res ) {
  crawler.init(req.query.stock);
  res.redirect('/');
});

app.get('/stock/:stock', function ( req, res ) {
  brain.expect(req.params.stock, function ( data, output ) {
    res.render('item.jade', {
      curr : data,
      expect : output
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

app.listen(3000, function(){
  console.log('APP LISTEN AT PORT 3000');
});