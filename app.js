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
          str.push('상승확률'+numeral(expect[0]).format('0%'));
          if ( expect[0] > 0.8 ) {
            str.push('내일 상승')
          } else if ( expect[0] < 0.2 ) {
            str.push('내일 하락')
          }
          if ( expect[1] > 0.8 ) {
            str.push('5일 상승')
          } else if ( expect[1] < 0.2 ) {
            str.push('5일 하락')
          }
          if ( expect[2] > 0.8 ) {
            str.push('10일 상승')
          } else if ( expect[2] < 0.2 ) {
            str.push('10일 하락')
          }
          if ( expect[3] > expect[5] && expect[3] > 0.8 ) {
            str.push('5일 후 매수')
          } else if ( expect[5] > 0.8 ){
            str.push('5일 내 매수')
          }
          if ( expect[4] > expect[6] && expect[4] > 0.8 ) {
            str.push('5일 후 매도')
          } else if ( expect[6] > 0.8 ){
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

app.get('/chart', function( req, res ) {
  stock.load(req.query.id, function( err, item ) {
    if (item !== null){
      var data = item.dailyData.slice(-70);
      async.reduce(data, {
        labels : [],
        stock : [],
        vol : []
      }, function(dataset, price, next){
        dataset.labels.push(dateformat(price.at, 'mm-dd'));
        dataset.stock.push(price.close);
        dataset.vol.push(price.volume);
        next(false, dataset);
      }, function(err, dataset){
        res.send(req.query.cb+'('+JSON.stringify(dataset)+');');
      });
    }else{
      res.status(404).send("");
    }
  });
});

app.get('/stock/:stock', function( req, res ) {
  stock.load(req.params.stock, function( err, item ) {
    if (item !== null){
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
            if ( number > 0.8 ) {
              return '오른다! (' + numeral(number).format('0.0%') + ')';
            } else if ( number > 0.5 ) {
              return '오를걸. (' + numeral(number).format('0.0%') + ')';
            } else if ( number > 0.2 ) {
              return '내릴걸. (' + numeral(number).format('0.0%') + ')';
            } else {
              return '내린다!';
            }
          }
        });
      });
    }else{
      res.status(404).send("");
    }
  })
});

app.listen(3000, function() {
  console.log('APP LISTEN AT PORT 3000');
});