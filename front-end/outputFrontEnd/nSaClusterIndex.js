/**
 * Created by asoriano on 21/12/15.
 */


var VisnSaClusterIndex = {}; // Declare empty global object

// Área de dibujado
    // SVG
    VisnSaClusterIndex.divId  = "#saPerClusterIndex";
    VisnSaClusterIndex.width  = parseInt( d3.selectAll( VisnSaClusterIndex.divId ).style("width") );
    VisnSaClusterIndex.height = parseInt( d3.selectAll( VisnSaClusterIndex.divId ).style("height") );
    VisnSaClusterIndex.svg    = d3.select( VisnSaClusterIndex.divId ).append("svg")
        .attr("width",  VisnSaClusterIndex.width )
        .attr("height", VisnSaClusterIndex.height );

    // CHART
    VisnSaClusterIndex.margin = { top: 20, right: 20, bottom: 20, left: 30 };
    VisnSaClusterIndex.w      = VisnSaClusterIndex.width  - VisnSaClusterIndex.margin.left - VisnSaClusterIndex.margin.right;
    VisnSaClusterIndex.h      = VisnSaClusterIndex.height - VisnSaClusterIndex.margin.top  - VisnSaClusterIndex.margin.bottom;
    VisnSaClusterIndex.chart  = VisnSaClusterIndex.svg.append("g").attr("transform",
                                    "translate(" + VisnSaClusterIndex.margin.left + ", " +
                                                   VisnSaClusterIndex.margin.top  +        ")");

// Scalas
    VisnSaClusterIndex.x = d3.scale.linear().domain([0, OutputModel.timeWindow - 1])
                                            .range([0, VisnSaClusterIndex.w ]);

    VisnSaClusterIndex.y = d3.scale.linear().domain([-1, 2000])
                                            .range([ VisnSaClusterIndex.h, 0]);

// Linea
    VisnSaClusterIndex.line = d3.svg.line().x( function(d, i) { return VisnSaClusterIndex.x(i); } )
                                           .y( function(d, i) { return VisnSaClusterIndex.y(d); } );

// Clip
    VisnSaClusterIndex.chart.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width",  VisnSaClusterIndex.w )
        .attr("height", VisnSaClusterIndex.h );

// Axis
    VisnSaClusterIndex.xaxis = d3.svg.axis().scale( VisnSaClusterIndex.x ).orient("bottom");

    VisnSaClusterIndex.chart.append("g").attr("class", "x axis")
        .attr("transform", "translate(0," + VisnSaClusterIndex.y(0) + ")").call( VisnSaClusterIndex.xaxis );

    VisnSaClusterIndex.yaxis = d3.svg.axis().scale( VisnSaClusterIndex.y ).orient("left");

    VisnSaClusterIndex.chart.append("g").attr("class", "y axis").call( VisnSaClusterIndex.yaxis );

// Paths
    VisnSaClusterIndex.path = VisnSaClusterIndex.chart.append("g")
        .attr("clip-path", "url(#clip)")
        .append("path")
        .datum( OutputModel.saIndex )
        .attr("class", "line")
        .attr("d", VisnSaClusterIndex.line );

// Update function
    function updateSaClusterIndex( newP ) {

        // push a new data point onto the back
        OutputModel.saIndex.push( 100*newP );

        // Actualizamos escala y axis en componente Y
        var range = d3.max( OutputModel.saIndex ) - d3.min( OutputModel.saIndex );
        VisnSaClusterIndex.y.domain( [ d3.min( OutputModel.saIndex ) - range/10,
                                       d3.max( OutputModel.saIndex ) + range/10   ]);

        VisnSaClusterIndex.chart.select(".y.axis").transition().duration(100).call( VisnSaClusterIndex.yaxis);

        // redraw the line, and slide it to the left
        VisnSaClusterIndex.path
            .attr("d", VisnSaClusterIndex.line )
            .attr("transform", null)
            .transition()
            .duration(100)
            .ease("linear")
            .attr("transform", "translate(" + VisnSaClusterIndex.x(-1) + ",0)");

        // pop the old data point off the front
        OutputModel.saIndex.shift();

    }