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
  res.set('Cache-Control', 'no-cache');
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
      }
    });
  });
});

app.get('/add', function( req, res ) {
  crawler.init(req.query.stock);
  res.redirect('/');
});

app.get('/chart', function( req, res ) {
  res.set('Content-Type', 'text/javascript');
  res.set('Cache-Control', 'no-cache');
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
  res.set('Cache-Control', 'no-cache');
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
              return numeral(number * 100).format('0.0');
            } else {
              return '';
            }
          },
          prediction : function( number ) {
            if ( number > 0.5 ) {
              return '▲';
            } else if ( number > -0.5){
              return '○';
            } else {
              return '▼';
            }
          },
          predStyle : function ( number ) {
            if ( typeof number === 'number' ) {
              return 'background:hsl('+Math.round(60 + number * 60)+',100%,50%)';
            } else {
              return 'opacity:0';
            }
          },
          range : function ( start, end ) {
            var range = [];
            while ( start < end ){
              range.push(start++);
            }
            return range;
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