function loaded( dataset ){
  var stockData = {
    labels : dataset.labels,
    datasets : [
      {
        label : "Closing Price",
        fillColor : "rgba(0,220,220,0.2)",
        strokeColor : "rgba(0,220,220,1)",
        pointColor : "rgba(0,220,220,1)",
        pointStrokeColor : "#0ff",
        pointHighlightFill : "#0ff",
        pointHighlightStroke : "rgba(0,220,220,1)",
        data : dataset.stock
      }
    ]
  };
  var volData = {
    labels : dataset.labels,
    datasets : [
      {
        label : "Closing Price",
        fillColor : "rgba(220,0,0,0.2)",
        strokeColor : "rgba(220,0,0,1)",
        pointColor : "rgba(220,0,0,1)",
        pointStrokeColor : "#f00",
        pointHighlightFill : "#f00",
        pointHighlightStroke : "rgba(220,0,0,1)",
        data : dataset.vol
      }
    ]
  };
  
  var width = document.getElementById('stock-chart').parentElement.offsetWidth;
  document.getElementById('stock-chart').width = width;
  document.getElementById('vol-chart').width = width;
  
  var stockctx = document.getElementById('stock-chart').getContext('2d');
  new Chart(stockctx).Line(stockData, {
    showScale : false,
    scaleShowLabels:false,
    showTooltips: true,
    tooltipEvents: ["mousemove", "touchstart", "touchmove"],
    pointDot:false,
    scaleShowGridLines : false,
    scaleFontSize : 9,
    tooltipFontSize : 12,
    tooltipTitleFontSize : 12
  });
  var volctx = document.getElementById('vol-chart').getContext('2d');
  new Chart(stockctx).Bar(volData, {
    showScale : false,
    scaleShowLabels:false,
    showTooltips: true,
    scaleShowGridLines : false,
    tooltipEvents: ["mousemove", "touchstart", "touchmove"],
    scaleFontSize : 9,
    tooltipFontSize : 12,
    tooltipTitleFontSize : 12,
    barValueSpacing : 0
  });
};