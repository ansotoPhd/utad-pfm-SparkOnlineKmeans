// Code goes here
indexOfMax = function(data) {
  var max = data[0],
    index = 0;
  for (var d in data) {
    if (data[d] > max) {
      max = data[d];
      index = d;
    }
  }
  return index;
};

indexOfMin = function(data) {
  var min = data[0],
    index = 0;
  for (var d in data) {
    if (data[d] < min) {
      min = data[d];
      index = d;
    }
  }
  return index;
};

errorEllipse = function(stdDevX, stdDevY, cor, center, level) {
  var errEllipse,
    cov = cor * stdDevX * stdDevY,
    covmat = [
      [stdDevX * stdDevX, cov],
      [cov, stdDevY * stdDevY]
    ],
    eig = numeric.eig(covmat),
    scale = Math.sqrt(jStat.chisquare.inv(level, 2)),
    maxLambdaI = indexOfMax(eig.lambda.x),
    minLambdaI = indexOfMin(eig.lambda.x),
    rx = stdDevX > stdDevY ? Math.sqrt(eig.lambda.x[maxLambdaI]) * scale : Math.sqrt(eig.lambda.x[minLambdaI]) * scale,
    ry = stdDevY > stdDevX ? Math.sqrt(eig.lambda.x[maxLambdaI]) * scale : Math.sqrt(eig.lambda.x[minLambdaI]) * scale,
    v1 = eig.E.x[maxLambdaI],
    theta =  Math.atan2(v1[1], v1[0]);
    
  if (theta < 0) {
    theta += 2 * Math.PI;
  }
  //make the ellipse object
  errEllipse = {
    rx: rx,
    ry: ry,
    cx: center.x,
    cy: center.y,
    orient: -(theta * 180 / Math.PI)
  };
  return errEllipse;
};

var xData = testData.x,
xDataDev = d3.deviation(xData),
xMean = d3.mean(xData),
xExtent = d3.extent(xData),

yData = testData.y,
yMean = d3.mean(yData),
yDataDev = d3.deviation(yData),
yExtent = d3.extent(yData),
cor = jStat.corrcoeff(xData, yData);


$("#dataInfo").append("<p>x-mean: " + xMean + "</p>");
$("#dataInfo").append("<p>y-mean: " + yMean + "</p>");
$("#dataInfo").append("<p>x-dev: " + xDataDev + "</p>");
$("#dataInfo").append("<p>y-dev: " + yDataDev + "</p>");
$("#dataInfo").append("<p>cor coef: " + cor + "</p>");
//stdDev and cor from test data (n=500)
var ellipse90 = errorEllipse(xDataDev,  yDataDev, cor, {
  x: xMean,
  y: yMean
}, 0.9);

var ellipse99 = errorEllipse(xDataDev,  yDataDev, cor, {
  x: xMean,
  y: yMean
}, 0.99);

var createEllipse = function(){
  svg.selectAll("ellipse").remove();
  //get input values
  var userEllipse, devX=$("#dev1").val(),
  devY=$("#dev2").val(),
  cor=$("#cor").val(),
  level=$("#level").val();
  
  userEllipse =  errorEllipse(devX, devY, cor, {
  x: xMean,
  y: yMean
}, level)

  svg.append('ellipse')
  .attr('class', 'q-ellipse-90')
  .attr('rx', Math.abs(xScale(xExtent[0] + userEllipse.rx) - xScale(xExtent[0])))
  .attr('ry', Math.abs(yScale(yExtent[0] + userEllipse.ry) - yScale(yExtent[0])))
  .attr('transform', 'translate(' + xScale(userEllipse.cx) + ',' + yScale(userEllipse.cy) + ')rotate(' + userEllipse.orient + ')');

  
  
};

