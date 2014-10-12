/**
 * New node file
 */
var express = require('express');
var stylus = require('stylus');
var async = require('async');
var stock = require('./models/stock');

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

app.get('/', function( req, res ) {
  stock.getAll(function( err, items ) {
    res.render('index.jade', {
      stock : items,
      currformat : function( curr ) {
        return numeral(curr).format('0,0');
      },
      expect : function( expect ) {
        if ( expect ) {
          var str = [];
          if ( expect[0] > 0.65 ) {
            str.push('내일 상승')
          } else if ( expect[0] < 0.35 ) {
            str.push('내일 하락')
          }
          if ( expect[1] > 0.65 ) {
            str.push('5일 상승')
          } else if ( expect[1] < 0.35 ) {
            str.push('5일 하락')
          }
          if ( expect[2] > 0.65 ) {
            str.push('10일 상승')
          } else if ( expect[2] < 0.35 ) {
            str.push('10일 하락')
          }
          if ( expect[3] > expect[5] ) {
            str.push('5일 후 매수')
          } else {
            str.push('5일 내 매수')
          }
          if ( expect[4] > expect[6] ) {
            str.push('5일 후 매도')
          } else {
            str.push('5일 내 매도')
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

app.get('/stock/:stock', function( req, res ) {
  stock.load(req.params.stock, function( err, item ) {
    var prev = {
      close : 0
    };
    var data = item.dailyData.slice(-70);
    async.each(data, function( item, cb ) {
      item.diff = item.close - prev.close;
      prev = item;
      cb();
    }, function() {
      res.render('item.jade', {
        code : req.params.stock,
        title : item.title,
        curr : data.reverse(),
        expect : item.expect,
        dateformat : function( date ) {
          return dateformat(date, 'mm. dd.');
        },
        currformat : function( number ) {
          if ( number ) {
            return '￦ ' + numeral(number).format('0,0[.]00');
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
          if ( number > 0.65 ) {
            return '반드시! (' + numeral(number).format('0.0%') + ')';
          } else if ( number > 0.35 ) {
            return '아마도. (' + numeral(number).format('0.0%') + ')';
          } else {
            return '불가능!';
          }
        }
      });
    });
  })
});

app.listen(3000, function() {
  console.log('APP LISTEN AT PORT 3000');
});