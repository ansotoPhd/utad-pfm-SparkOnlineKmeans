var width = 500,
  height = 500,
  margin = 25,
  xAxis, yAxis,
  svg = d3.select("#plot").append('svg').attr('width', width).attr('height', height).append('g').attr("transform", "translate(25,25)"),
  xScale = d3.scale.linear().range([margin, width + (margin * 2)]).domain(xExtent),
  yScale = d3.scale.linear().range([height - (margin * 2), 0]).domain(yExtent);

xAxis = d3.svg.axis()
  .scale(xScale)
  .orient("bottom");

yAxis = d3.svg.axis()
  .scale(yScale)
  .orient("left");

svg.append('ellipse')
  .attr('class', 'q-ellipse-99')
  .attr('rx', Math.abs(xScale(xExtent[0] + ellipse99.rx) - xScale(xExtent[0])))
  .attr('ry', Math.abs(yScale(yExtent[0] + ellipse99.ry) - yScale(yExtent[0])))
  .attr('transform', 'translate(' + xScale(ellipse99.cx) + ',' + yScale(ellipse99.cy) + ')rotate(' + ellipse99.orient + ')');

svg.append('ellipse')
  .attr('class', 'q-ellipse-90')
  .attr('rx', Math.abs(xScale(xExtent[0] + ellipse90.rx) - xScale(xExtent[0])))
  .attr('ry', Math.abs(yScale(yExtent[0] + ellipse90.ry) - yScale(yExtent[0])))
  .attr('transform', 'translate(' + xScale(ellipse90.cx) + ',' + yScale(ellipse90.cy) + ')rotate(' + ellipse99.orient + ')');

svg.append("g")
  .attr("class", "axis")
  .attr("transform", "translate(" + margin + ",0)")
  .call(yAxis);

svg.append("g")
  .attr("class", "x axis")
  .attr("transform", "translate(0," + (height - (2 * margin)) + ")")
  .call(xAxis);

svg.selectAll("circle").data(testData.x).enter()
							.append("circle")
							.attr("cx", function (d,i) {
								return xScale(testData.x[i]);
							})
							.attr("r", 3)
							.attr("cy", function (d,i) {
								return yScale(testData.y[i]);
							}).style({
								'opacity' : 0.5,
								'stroke' : '#0af',
								'fill' : '#cfc',
								'stroke-width' : 1
							});