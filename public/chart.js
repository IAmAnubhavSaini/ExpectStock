function loaded( dataset ){
  var stockData = {
    labels : dataset.labels,
    datasets : [
      {
        label : "Closing Price",
        fillColor : "rgba(220,220,220,0.2)",
        strokeColor : "rgba(220,220,220,1)",
        pointColor : "rgba(220,220,220,1)",
        pointStrokeColor : "#fff",
        pointHighlightFill : "#fff",
        pointHighlightStroke : "rgba(220,220,220,1)",
        data : dataset.stock
      }
    ]
  };
  var volData = {
    labels : dataset.labels,
    datasets : [
      {
        label : "Closing Price",
        fillColor : "rgba(220,220,220,0.2)",
        strokeColor : "rgba(220,220,220,1)",
        pointColor : "rgba(220,220,220,1)",
        pointStrokeColor : "#fff",
        pointHighlightFill : "#fff",
        pointHighlightStroke : "rgba(220,220,220,1)",
        data : dataset.vol
      }
    ]
  };
  
  var width = document.getElementById('stock-chart').parentElement.offsetWidth;
  document.getElementById('stock-chart').width = width;
  document.getElementById('vol-chart').width = width;
  
  var stockctx = document.getElementById('stock-chart').getContext('2d');
  new Chart(stockctx).Line(stockData, {
    scaleShowGridLines : false,
    pointDot : false,
    scaleFontSize : 9,
    tooltipFontSize : 12,
    tooltipTitleFontSize : 12
  });
  var volctx = document.getElementById('vol-chart').getContext('2d');
  new Chart(volctx).Bar(volData, {
    scaleShowGridLines : false,
    scaleFontSize : 9,
    tooltipFontSize : 12,
    tooltipTitleFontSize : 12
  });
};