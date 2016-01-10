/**
 * Created by asoriano on 22/12/15.
 */


// -------------------------------------------------------------------
//          VISUALIZACIÓN - Cost plot
// -------------------------------------------------------------------

var VisCostPlot = {}; // Declare empty global object

    // Drawing area
    // ------------------------------------------------------------------------

    // SVG
        VisCostPlot.divId  = "#errorPlot";
        VisCostPlot.width  = parseInt( d3.selectAll( VisCostPlot.divId ).style("width") );
        VisCostPlot.height = parseInt( d3.selectAll( VisCostPlot.divId ).style("height") );
        VisCostPlot.svg    =
            d3.select( VisCostPlot.divId ).append("svg")
                .attr("width",  VisCostPlot.width )
                .attr("height", VisCostPlot.height );

    // CHART
        VisCostPlot.margin = { top: 20, right: 20, bottom: 20, left: 40 };
        VisCostPlot.w      = VisCostPlot.width  - VisCostPlot.margin.left - VisCostPlot.margin.right;
        VisCostPlot.h      = VisCostPlot.height - VisCostPlot.margin.top  - VisCostPlot.margin.bottom;
        VisCostPlot.chart  =
            VisCostPlot.svg.append("g").attr("transform",
                "translate(" + VisCostPlot.margin.left + ", " + VisCostPlot.margin.top + ")");

// Scales
// ------------------------------------------------------------------------
    VisCostPlot.x = d3.scale.linear().domain([0, OutputModel.timeWindow - 1])
        .range([0, VisCostPlot.w ]);

    VisCostPlot.y = d3.scale.linear().domain([-1, 2000])
        .range([ VisCostPlot.h, 0]);

// Line
// ------------------------------------------------------------------------
    VisCostPlot.line = d3.svg.line().x( function(d, i) { return VisCostPlot.x(i); } )
        .y( function(d, i) { return VisCostPlot.y(d); } );

// Clip
// ------------------------------------------------------------------------
    VisCostPlot.chart.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width",  VisCostPlot.w )
        .attr("height", VisCostPlot.h );

// Axis
// ------------------------------------------------------------------------
    VisCostPlot.xaxis = d3.svg.axis().scale( VisCostPlot.x ).orient("bottom");

    VisCostPlot.chart.append("g").attr("class", "x axis")
        .attr("transform", "translate(0," + VisCostPlot.y(0) + ")").call( VisCostPlot.xaxis );

    VisCostPlot.yaxis = d3.svg.axis().scale( VisCostPlot.y ).orient("left");

    VisCostPlot.chart.append("g").attr("class", "y axis").call( VisCostPlot.yaxis );

// Paths
// ------------------------------------------------------------------------
    VisCostPlot.path = VisCostPlot.chart.append("g")
        .attr("clip-path", "url(#clip)")
        .append("path")
        .datum( OutputModel.realCost )
        .attr("class", "line")
        .attr("d", VisCostPlot.line );

    VisCostPlot.path2 = VisCostPlot.chart.append("g")
        .attr("clip-path", "url(#clip)")
        .append("path")
        .datum( OutputModel.cost )
        .attr("class", "line2")
        .attr("d", VisCostPlot.line );

// Update function
// ------------------------------------------------------------------------
function updateCostPlot( newP ) {

    // push a new data point onto the back
    OutputModel.realCost.push( newP[0] );
    OutputModel.cost.push( newP[1] );

    // Actualizamos escala y axis en componente Y
    VisCostPlot.y.domain( [ 0.9*d3.min( OutputModel.realCost.concat( OutputModel.cost ) ),
        1.1*d3.max( OutputModel.realCost.concat( OutputModel.cost ) )  ]);

    VisCostPlot.chart.select(".y.axis").transition().duration(100).call( VisCostPlot.yaxis);

    // redraw the line, and slide it to the left
    VisCostPlot.path
        .attr("d", VisCostPlot.line)
        .attr("transform", null)
        .transition()
        .duration(100)
        .ease("linear")
        .attr("transform", "translate(" + VisCostPlot.x(-1) + ",0)");

    VisCostPlot.path2
        .attr("d", VisCostPlot.line)
        .attr("transform", null)
        .transition()
        .duration(100)
        .ease("linear")
        .attr("transform", "translate(" + VisCostPlot.x(-1) + ",0)");

    // pop the old data point off the front
    OutputModel.realCost.shift();
    OutputModel.cost.shift();

}