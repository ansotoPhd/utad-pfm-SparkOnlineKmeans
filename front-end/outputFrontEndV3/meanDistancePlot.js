/**
 * Created by asoriano on 21/12/15.
 */


var VisnMeanDistPlot = {}; // Declare empty global object

//  Área de dibujado
// ---------------------------------------------------------------------
    // SVG
    VisnMeanDistPlot.divId  = "#meanCtoSaDist";
    VisnMeanDistPlot.width  = parseInt( d3.selectAll( VisnMeanDistPlot.divId ).style("width") );
    VisnMeanDistPlot.height = parseInt( d3.selectAll( VisnMeanDistPlot.divId ).style("height") );
    VisnMeanDistPlot.svg    = d3.select( VisnMeanDistPlot.divId ).append("svg")
                                .attr("width",  VisnMeanDistPlot.width )
                                .attr("height", VisnMeanDistPlot.height );

    // CHART
    VisnMeanDistPlot.margin = { top: 20, right: 20, bottom: 20, left: 30 };
    VisnMeanDistPlot.w      = VisnMeanDistPlot.width  - VisnMeanDistPlot.margin.left - VisnMeanDistPlot.margin.right;
    VisnMeanDistPlot.h      = VisnMeanDistPlot.height - VisnMeanDistPlot.margin.top  - VisnMeanDistPlot.margin.bottom;
    VisnMeanDistPlot.chart  = VisnMeanDistPlot.svg.append("g")
                                .attr("transform",
                                      "translate(" + VisnMeanDistPlot.margin.left + ", " +
                                                     VisnMeanDistPlot.margin.top  +        ")");

// Scalas
// ---------------------------------------------------------------------
    VisnMeanDistPlot.x = d3.scale.linear().domain([0, OutputModel.timeWindow - 1])
                                            .range([0, VisnMeanDistPlot.w ]);

    VisnMeanDistPlot.y = d3.scale.linear().domain([-1, 2000])
                                            .range([ VisnMeanDistPlot.h, 0]);

// Linea
// ---------------------------------------------------------------------
    VisnMeanDistPlot.line = d3.svg.line()
                                         .defined(function(d) { return d!=null; })
                                         .x( function(d, i) { return VisnMeanDistPlot.x(i); } )
                                         .y( function(d, i) { return VisnMeanDistPlot.y(d); } );

// Clip
// ---------------------------------------------------------------------
    VisnMeanDistPlot.chart.append("defs").append("clipPath")
        .attr("id", "clip").append("rect")
        .attr("width",  VisnMeanDistPlot.w )
        .attr("height", VisnMeanDistPlot.h );

// Axis
// ---------------------------------------------------------------------
    VisnMeanDistPlot.xaxis = d3.svg.axis().scale( VisnMeanDistPlot.x ).orient("bottom");

    VisnMeanDistPlot.chart.append("g").attr("class", "x axis")
        .attr("transform", "translate(0," + VisnMeanDistPlot.y(0) + ")").call( VisnMeanDistPlot.xaxis );

    VisnMeanDistPlot.yaxis = d3.svg.axis().scale( VisnMeanDistPlot.y ).orient("left");

    VisnMeanDistPlot.chart.append("g").attr("class", "y axis").call( VisnMeanDistPlot.yaxis );

// Paths
// ---------------------------------------------------------------------
    VisnMeanDistPlot.paths = [];
    for( var i=0; i< OutputModel.meanDist.length; i++ ) {
        //VisnMeanDistPlot.paths[i] = VisnMeanDistPlot.chart.append("g")
        //                            .attr("clip-path", "url(#clip)")
        //                            .append("path")
        //                            .datum( OutputModel.meanDist[i] )
        //                            .attr(  "class", "line" )
        //                            .style( "fill", "none" )
        //                            .style( "stroke",OutputModel.colors(i) )
        //                            .style( "stroke-width","1.5px" )
        //                            .attr(  "d", VisnMeanDistPlot.line );

        VisnMeanDistPlot.paths[i] = insertNewPath(i)
    }

    console.log( VisnMeanDistPlot.paths )




    function insertNewPath( i ){

        var g = VisnMeanDistPlot.chart.append("g")
            .attr("clip-path", "url(#clip)");

        g.append("path")
            .datum( OutputModel.meanDist[i] )
            .attr(  "class", "line" )
            .style( "fill", "none" )
            .style( "stroke",OutputModel.colors(i) )
            .style( "stroke-width","1.5px" )
            .attr(  "d", VisnMeanDistPlot.line );

        return g;
    }

// Update function
// ---------------------------------------------------------------------
    function updateMeanDistPlot( newP ) {

        // Cambio en el número de paths

            // Mas paths
            if( newP.length > OutputModel.meanDist.length  ){

                console.log( "Distinto número de clusters." )
                console.log( newP.length + " " + OutputModel.meanDist.length + " " +  VisnMeanDistPlot.paths.length )
                for( var i = OutputModel.meanDist.length; i < newP.length; i++ ){

                    console.log( "Insertando paths" )
                    OutputModel.meanDist.push( new Array( OutputModel.timeWindow ).fill(0) );
                    var nPath = insertNewPath( i );
                    VisnMeanDistPlot.paths.push( nPath );

                }

                console.log( newP.length + " " + OutputModel.meanDist.length + " " +  VisnMeanDistPlot.paths.length )

            // Menos paths
            }else if( newP.length < OutputModel.meanDist.length ){

                console.log( "Distinto número de clusters." )
                console.log( newP.length + " " + OutputModel.meanDist.length + " " +  VisnMeanDistPlot.paths.length )
                for( var i = newP.length ; i < OutputModel.meanDist.length; i++ ){

                    console.log( "Eliminando paths" )
                    OutputModel.meanDist[i].push( null );
                }

                console.log( newP.length + " " + OutputModel.meanDist.length + " " +  VisnMeanDistPlot.paths.length )
            }

        var max = [], min = [];
        for( var i=0; i<newP.length; i++ ) {
            OutputModel.meanDist[i].push( newP[i] );
            max.push( d3.max( OutputModel.meanDist[i] ) );
            min.push( d3.min( OutputModel.meanDist[i] ) );
        }

        // Actualizamos escala y axis en componente Y
        var range = d3.max( max ) - d3.min( min );
        VisnMeanDistPlot.y.domain( [ d3.min( min ) - range/10,
                                     d3.max( max ) + range/10   ]);

        VisnMeanDistPlot.chart.select(".y.axis").transition().duration(100).call( VisnMeanDistPlot.yaxis );

        // redraw the line, and slide it to the left
        for( var i=0; i<OutputModel.meanDist.length; i++ ) {
            VisnMeanDistPlot.paths[i].selectAll("path")
                .attr("d", VisnMeanDistPlot.line)
                .attr("transform", null)
                .transition()
                .duration(100)
                .ease("linear")
                .attr("transform", "translate(" + VisnMeanDistPlot.x(-1) + ",0)");

            // pop the old data point off the front
            OutputModel.meanDist[i].shift();
        }

    }