/**
 * New node file
 */
var express = require('express');
var stylus = require('stylus');
var async = require('async');
var stock = require('./models/stock');
var crawler = require('./ctrls/crawler');

var numeral = require('numeral');

var app = express();
require('express-params').extend(app);

app.param('stock', /^[0-9a-zA-Z]+$/);
app.use(stylus.middleware({
  src : './styl',
  dest : './public'
}));
app.use('/static', express.static(__dirname + '/public'));

app.get('/', function( req, res ) {
  stock.getAll(function( err, items ) {
    res.render('index.jade', {
      stock : items,
      currformat : function( curr ) {
        return numeral(curr).format('0,0');
      },
      probformat : function( prob ) {
        if ( prob ) {
          return numeral(prob).format('0.0%');
        } else {
          return '0.0%';
        }
      },
      expect : function( expect ) {
        if ( expect ) {
          var str = [];
          str.push({
            text : numeral(expect[0]).format('0%'),
            p : expect[0]
          });
          if ( expect[0] > 0.8 ) {
            str.push({
              text : '내일 상승',
              p : expect[0]
            });
          } else if ( expect[0] < 0.2 ) {
            str.push({
              text : '내일 하락',
              p : (1 - expect[0])
            });
          }
          if ( expect[1] > 0.8 ) {
            str.push({
              text : '1주 상승',
              p : expect[1]
            });
          } else if ( expect[1] < 0.2 ) {
            str.push({
              text : '1주 하락',
              p : (1 - expect[1])
            });
          }
          if ( expect[2] > 0.8 ) {
            str.push({
              text : '2주 상승',
              p : expect[2]
            });
          } else if ( expect[2] < 0.2 ) {
            str.push({
              text : '2주 하락',
              p : (1 - expect[2])
            });
          }
          if ( expect[3] > expect[5] && expect[3] > 0.8 ) {
            str.push({
              text : '1주 후 매수',
              p : expect[3]
            });
          } else if ( expect[5] > 0.8 ) {
            str.push({
              text : '1주 내 매수',
              p : expect[5]
            });
          }
          if ( expect[4] > expect[6] && expect[4] > 0.8 ) {
            str.push({
              text : '1주 후 매도',
              p : expect[4]
            });
          } else if ( expect[6] > 0.8 ) {
            str.push({
              text : '1주 내 매도',
              p : expect[6]
            });
          }
          return str;
        } else {
          return [];
        }
      }
    });
  });
});

app.get('/add', function( req, res ) {
  crawler.init(req.query.stock);
  res.redirect('/');
});

app.get('/chart', function( req, res ) {
  stock.load(req.query.id, function( err, item ) {
    if ( item !== null ) {
      var data = item.dailyData.slice(-70);
      async.reduce(data, {
        labels : [],
        stock : [],
        vol : []
      }, function( dataset, price, next ) {
        dataset.labels.push(price.at.slice(4, 6) + '-' + price.at.slice(6));
        dataset.stock.push(price.close);
        dataset.vol.push(price.volume);
        next(false, dataset);
      }, function( err, dataset ) {
        res.send(req.query.cb + '(' + JSON.stringify(dataset) + ');');
      });
    } else {
      res.status(404).send("");
    }
  });
});

app.get('/stock/:stock', function( req, res ) {
  stock.load(req.params.stock, function( err, item ) {
    if ( item !== null ) {
      var prev = {
        close : 0
      };
      var data = item.dailyData.slice(-70);
      async.each(data, function( item, cb ) {
        item.diff = item.close - prev.close;
        prev = item;
        cb();
      }, function() {
        var rev = data.reverse();
        res.render('item.jade', {
          code : req.params.stock,
          title : item.title,
          curr : rev,
          price : rev[0].close,
          expect : item.expect,
          dateformat : function( date ) {
            if ( date ) {
              return date.slice(4, 6) + '. ' + date.slice(6) + '.';
            } else {
              return 'NONE.';
            }
          },
          currformat : function( number ) {
            if ( number ) {
              return '￦ ' + numeral(number).format('0,0');
            } else {
              return '-';
            }
          },
          diffformat : function( number ) {
            if ( number ) {
              return (number > 0) ? '▲' + number : '▼' + (-number);
            } else {
              return '-';
            }
          },
          predictformat : function( number ) {
            if ( number ) {
              return numeral(number).format('0.0%');
            } else {
              return '정보없음';
            }
          }
        });
      });
    } else {
      res.status(404).send("");
    }
  })
});

app.listen(3000, function() {
  console.log('APP LISTEN AT PORT 3000');
});