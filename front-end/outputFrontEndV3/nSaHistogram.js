/**
 * Created by asoriano on 22/12/15.
 */


// -------------------------------------------------------------------
//          VISUALIZACIÓN - Histogram
// -------------------------------------------------------------------

var VisSaClusterHist = {}; // Declare empty global object

// Drawing area
// ------------------------------------------------------------------------

    // SVG
    VisSaClusterHist.divId  = "#saPerClusterHist";
    VisSaClusterHist.width  = parseInt( d3.selectAll(VisSaClusterHist.divId).style("width") );
    VisSaClusterHist.height = parseInt( d3.selectAll(VisSaClusterHist.divId).style("height") );
    VisSaClusterHist.svg    = d3.select( VisSaClusterHist.divId ).append("svg")
        .attr("width", VisSaClusterHist.width ).attr("height", VisSaClusterHist.height );

    // CHART
    VisSaClusterHist.margin = { top: 20, right: 20, bottom: 20, left: 30 };
    VisSaClusterHist.w      = VisSaClusterHist.width  - VisSaClusterHist.margin.left - VisSaClusterHist.margin.right;
    VisSaClusterHist.h      = VisSaClusterHist.height - VisSaClusterHist.margin.top  - VisSaClusterHist.margin.bottom;
    VisSaClusterHist.chart  = VisSaClusterHist.svg.append("g")
        .attr("transform", "translate(" +
            VisSaClusterHist.margin.left + ", " + VisSaClusterHist.margin.top + ")");


// Scale
// ------------------------------------------------------------------------
    VisSaClusterHist.scale = d3.scale.linear().domain([0, 1]).range([0, VisSaClusterHist.h]);


// Axis
// ------------------------------------------------------------------------
    // x Scale -> x Axis -> Append to chart
    VisSaClusterHist.xScale = d3.scale.linear().domain([0, VisSaClusterHist.w]).range([0, VisSaClusterHist.w]);
    VisSaClusterHist.xAxis  = d3.svg.axis().scale( VisSaClusterHist.xScale );
    VisSaClusterHist.chart.append("g").attr("class", "x axis")
        .attr("transform", "translate(0," + VisSaClusterHist.h + ")")
        .call( VisSaClusterHist.xAxis );

    // y Scale -> y Axis -> Append to chart
    VisSaClusterHist.yScale = d3.scale.linear().domain([0, 1]).range([VisSaClusterHist.h, 0]);
    VisSaClusterHist.yAxis  = d3.svg.axis().scale( VisSaClusterHist.yScale ).orient("left");
    VisSaClusterHist.chart.append("g").attr("class", "y axis").call( VisSaClusterHist.yAxis );


// Update data
// ------------------------------------------------------------------------
    function updateSaHist( dataset ){

        // Escala de valores [0,Max. Value] --> [0,h]
        VisSaClusterHist.scale.domain([0, d3.max( dataset) ]);

        // Barras
        VisSaClusterHist.chart.selectAll("rect").remove();
        var bars = VisSaClusterHist.chart.selectAll("rect").data( dataset );

        VisSaClusterHist.xScale.domain([-0.5, dataset.length-0.5])
            .range([0, VisSaClusterHist.w]);
        VisSaClusterHist.svg.select(".x.axis")
            .transition()
            .duration(100)
            .call( VisSaClusterHist.xAxis );

        // add bars to container
        bars.enter().append("rect")
            .attr("x", function(d, i) {
                return i * ( VisSaClusterHist.w / dataset.length);
            })
            .attr("y", function(d) {
                return VisSaClusterHist.h - VisSaClusterHist.scale(d); // [0,h] -> [h,0]
            })
            .attr("width", VisSaClusterHist.w / dataset.length - 1 )
            .attr("height", function(d) {
                return VisSaClusterHist.scale(d);
            })
            .attr("fill", function(d,i){ return OutputModel.colors(i) } );

        VisSaClusterHist.yScale.domain([0, d3.max(dataset)]);
        VisSaClusterHist.svg.select(".y.axis")
            .transition()
            .duration(100)
            .call( VisSaClusterHist.yAxis );

    }