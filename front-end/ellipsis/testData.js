var other_testData = {
x : [5,7,11,15,16,17,18],
y : [8, 5, 8, 9, 17, 18, 25]
  
};

function genTestData(numPoints){
  var data = {x:[], y:[]};
  for(var i = 0; i < numPoints; i++){
    data.x[i] = jStat.normal.inv(Math.random(), 8.5, 2);
    data.y[i] = jStat.normal.inv(Math.random(), 6.5, 3);
    data.y[i] += data.x[i] * 2.1;
  }
  return data;
}

var testData = genTestData(700);