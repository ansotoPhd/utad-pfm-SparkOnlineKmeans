/**
 * Created by asoriano on 22/12/15.
 */

// -------------------------------------------------------------------
//          VISUALIZACIÓN - Scatterplot
// -------------------------------------------------------------------

var VisScatterplot = {}; // Declare empty global object

// Global configuration
// ----------------------------------------------------------------------
    VisScatterplot.pointRadius = 5;

// Drawing area
// ----------------------------------------------------------------------

    // SVG
    VisScatterplot.divId  = "#scatterplot";
    VisScatterplot.width  = parseInt( d3.selectAll( VisScatterplot.divId ).style("width") );
    VisScatterplot.height = parseInt( d3.selectAll( VisScatterplot.divId ).style("height") );
    VisScatterplot.svg    = d3.select( VisScatterplot.divId ).append("svg")
                            .attr("width",  VisScatterplot.width )
                            .attr("height", VisScatterplot.height );

    // CHART
    VisScatterplot.margin = {top: 20, right: 40, bottom: 30, left: 40};

    if( VisScatterplot.width > VisScatterplot.height ){
        VisScatterplot.w = VisScatterplot.height - VisScatterplot.margin.top  - VisScatterplot.margin.bottom;
    }else{
        VisScatterplot.w = VisScatterplot.width  - VisScatterplot.margin.left - VisScatterplot.margin.right;
    }
    VisScatterplot.chart  = VisScatterplot.svg.append("g")
                            .attr("transform",
                                "translate(" +  VisScatterplot.margin.left + ", " +
                                                VisScatterplot.margin.top  +        ")");


// Scales
// ------------------------------------------------------------------------
    VisScatterplot.cScale = d3.scale.linear().domain( [0, 1] )
                            .range( [ VisScatterplot.pointRadius,
                                      VisScatterplot.w-VisScatterplot.pointRadius ] );

// Axis
// ------------------------------------------------------------------------
    VisScatterplot.xAxisScale  = d3.scale.linear()
                                 .domain( [ VisScatterplot.cScale.invert(0),
                                            VisScatterplot.cScale.invert(VisScatterplot.w)] )
                                 .range([0, VisScatterplot.w]);
    VisScatterplot.xAxis       = d3.svg.axis().scale( VisScatterplot.xAxisScale );

    VisScatterplot.yAxisScale  = d3.scale.linear()
                                  .domain([ VisScatterplot.cScale.invert(0),
                                            VisScatterplot.cScale.invert(VisScatterplot.w)])
                                  .range([VisScatterplot.w, 0]);
    VisScatterplot.yAxis       = d3.svg.axis().scale( VisScatterplot.yAxisScale ).orient("left");

    VisScatterplot.chart.append("g").attr("class", "outputY axis").call( VisScatterplot.yAxis );
    VisScatterplot.chart.append("g").attr("class", "outputX axis")
        .attr( "transform", "translate(0," + VisScatterplot.w + ")" ).call( VisScatterplot.xAxis );


// Updating centroids function
// ------------------------------------------------------------------------
    function updateCentroids( meanDistPerCluster ) {

        VisScatterplot.chart.selectAll(".centroid").remove();
        VisScatterplot.chart.selectAll(".meanD").remove();

        VisScatterplot.chart.selectAll(".centroid")
            .data( OutputModel.centroids )
            .enter()
            .append("circle")
            .attr("cx", function(d) {
                return VisScatterplot.cScale( d[0] );
            })
            .attr("cy", function(d) {
                return VisScatterplot.w -VisScatterplot.cScale( d[1] );
            })
            .attr("r", 2*VisScatterplot.pointRadius )
            .attr("class", "centroid")
            .attr("fill", function(d,i){ return OutputModel.colors(i) } );

        VisScatterplot.chart.selectAll(".meanD")
            .data( meanDistPerCluster )
            .enter()
            .append("circle")
            .attr("cx", function(d,i) {
                return VisScatterplot.cScale( OutputModel.centroids[i][0] ) ;
            })
            .attr("cy", function(d,i) {
                return VisScatterplot.w - VisScatterplot.cScale( OutputModel.centroids[i][1] ) ;
            })
            .attr("r", function(d){
                return VisScatterplot.cScale( d ) - VisScatterplot.cScale( 0 );
            } )
            .attr("class", "meanD")
            .style("stroke",function(d,i){ return OutputModel.colors(i) } )
            .style("stroke-width", 5)
            .style("stroke-dasharray", ("10,3"))
            .style("fill", "none");
    }


//  Updating rawDataFunction
// ------------------------------------------------------------------------
    function updateRawData() {

        // Borrado de datos antiguos
        VisScatterplot.chart.selectAll( ".rawdata" ).remove();

        // Procesado de datos
        var minRawX = d3.min( OutputModel.rawData, function(d) { return d[0]; } );
        var minRawY = d3.min( OutputModel.rawData, function(d) { return d[1]; } );
        var maxRawX = d3.max( OutputModel.rawData, function(d) { return d[0]; } );
        var maxRawY = d3.max( OutputModel.rawData, function(d) { return d[1]; } );

        var minCX = d3.min( OutputModel.centroids, function(d) { return d[0]; } );
        var minCY = d3.min( OutputModel.centroids, function(d) { return d[1]; } );
        var maxCX = d3.max( OutputModel.centroids, function(d) { return d[0]; } );
        var maxCY = d3.max( OutputModel.centroids, function(d) { return d[1]; } );

        var minVx = d3.min([minRawX, minCX]);
        var maxVx = d3.max([maxRawX, maxCX]);

        var minVy = d3.min([minRawY, minCY]);
        var maxVy = d3.max([maxRawY, maxCY]);

        // Actualización de escalas y ejes
        VisScatterplot.cScale.domain( [ d3.min( [minVx,minVy] ), d3.max( [maxVx, maxVy] ) ] );

        VisScatterplot.yAxisScale.domain([ VisScatterplot.cScale.invert(0),
                                           VisScatterplot.cScale.invert(VisScatterplot.w)]);
        VisScatterplot.xAxisScale.domain([ VisScatterplot.cScale.invert(0),
                                           VisScatterplot.cScale.invert(VisScatterplot.w)]);

        VisScatterplot.chart.select(".outputY.axis").transition().duration(100).call(VisScatterplot.yAxis);
        VisScatterplot.chart.select(".outputX.axis").transition().duration(100).call(VisScatterplot.xAxis);

        // Nuevos datos
        VisScatterplot.chart.selectAll(".rawdata")
            .data( OutputModel.rawData )
            .enter()
            .append("circle")
            .attr("cx", function(d) {
                return VisScatterplot.cScale( d[0] );
            })
            .attr("cy", function(d) {
                return VisScatterplot.w - VisScatterplot.cScale( d[1] );
            })
            .attr("r", VisScatterplot.pointRadius )
            .attr("class", "rawdata")
            .attr("fill", "yellow") ;
    }