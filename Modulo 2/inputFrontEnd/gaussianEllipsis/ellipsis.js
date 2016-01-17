
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

errorEllipse = function( stdDevX, stdDevY, cor, center, level ) {
    var errEllipse,
    // Covariance matrix
        cov = cor * stdDevX * stdDevY,
        covmat = [
          [stdDevX * stdDevX, cov],
          [cov, stdDevY * stdDevY]
        ],
    // Eigenvectors and eigenvalues calculation
        eig = numeric.eig(covmat),
    // Scale parameter of ellipse
        scale = Math.sqrt(jStat.chisquare.inv(level, 2)),
    // Index of max. and min. eigenvalues
        maxLambdaI = indexOfMax(eig.lambda.x),
        minLambdaI = indexOfMin(eig.lambda.x),
    // Radius of ellipse
        rx = Math.sqrt(eig.lambda.x[maxLambdaI]) * scale ,
        ry = Math.sqrt(eig.lambda.x[minLambdaI]) * scale ,
    // Eigenvector associated with max. eigenvalue
        v1 = eig.E.x[maxLambdaI],
    // Angle with respect to max. eigenvector
        theta =  Math.atan2(v1[1], v1[0]);
          if (theta < 0) {
            theta += 2 * Math.PI;
          }
  // make the ellipse object
      errEllipse = {
        rx: rx,
        ry: ry,
        cx: center.x,
        cy: center.y,
        orient: (theta * 180 / Math.PI)
      };

  return errEllipse;
};

