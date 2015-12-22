/**
 * Created by asoriano on 19/12/15.
 */

// -------------------------------------------------------------------
//          MODEL
// -------------------------------------------------------------------

    var OutputModel = {}; // Declare empty global object

        OutputModel.wsCentroids     = null;
        OutputModel.wsCentroidsUrl  = 'ws://localhost:7080/v2/broker/?topics=centroids';

        OutputModel.wsCost          = null;
        OutputModel.wsCostUrl       = 'ws://localhost:7080/v2/broker/?topics=cost';

        OutputModel.wsRawData       = null;
        OutputModel.wsRawDataUrl    = 'ws://localhost:7080/v2/broker/?topics=rawData';

        OutputModel.wsSaCluster     = null;
        OutputModel.wsSaClusterUrl  = 'ws://localhost:7080/v2/broker/?topics=samplesPerCluster';

        OutputModel.colors          = d3.scale.category10();

        OutputModel.centroids       = [[0,0],[-3,-1],[3,1]];

        OutputModel.rawData         = [];

        OutputModel.timeWindow      = 45;

        OutputModel.realCost        = new Array( OutputModel.timeWindow ).fill(0);
        OutputModel.cost            = new Array( OutputModel.timeWindow ).fill(0);

        OutputModel.saHist          = new Array( 3 ).fill(0);

        OutputModel.saIndex         = new Array( OutputModel.timeWindow ).fill(0);

        OutputModel.meanDist        = [[]]
        for( var i=0; i<3; i++ )
            OutputModel.meanDist[i]     = new Array( OutputModel.timeWindow ).fill(0);

// -------------------------------------------------------------------
//          WEBSOCKETS
// -------------------------------------------------------------------


    // Websockets - Open connection
    // *****************************
        document.getElementById('wbConnection').addEventListener('click', wbConnectionFunc);
        function wbConnectionFunc(){

            console.log('Trying to connect to socket');

            // Centroids socket
                OutputModel.wsCentroids = new WebSocket( OutputModel.wsCentroidsUrl );
                    OutputModel.wsCentroids.onopen    = wsCentroidsOpen;
                    OutputModel.wsCentroids.onerror   = wsErrorFunc;
                    OutputModel.wsCentroids.onmessage = wsCentroidsMsn;

            // RawData socket
                OutputModel.wsRawData = new WebSocket( OutputModel.wsRawDataUrl );
                    OutputModel.wsRawData.onopen    = wsRawDataOpen;
                    OutputModel.wsRawData.onerror   = wsErrorFunc;
                    OutputModel.wsRawData.onmessage = wsRawDataMsn;

            // Cost function socket
                OutputModel.wsCost = new WebSocket( OutputModel.wsCostUrl );
                    OutputModel.wsCost.onopen    = wsCostOpen;
                    OutputModel.wsCost.onerror   = wsErrorFunc;
                    OutputModel.wsCost.onmessage = wsCostMsg;

            // Samples per cluster socket
                OutputModel.wsSaCluster = new WebSocket( OutputModel.wsSaClusterUrl );
                    OutputModel.wsSaCluster.onopen    = wsSaClusterOpen;
                    OutputModel.wsSaCluster.onerror   = wsErrorFunc;
                    OutputModel.wsSaCluster.onmessage = wsSaClusterMsg;

        }

    // Websockets - Close connection
    // *****************************
        document.getElementById('wbClose').addEventListener('click', wbCloseFunc);
        function wbCloseFunc(){

            console.log( 'Closing WebSockets' );

            OutputModel.wsCentroids.close();
            OutputModel.wsRawData.close();
            OutputModel.wsCost.close();
            OutputModel.wsSaCluster.close();
        }

    // Websockets - Connection opened
    // *****************************
        var wsCentroidsOpen = function () {
            console.log('Centroids: Connection is open at ', new Date());
        };
        var wsCostOpen = function () {
            console.log('Cost: Connection is open at ', new Date());
        };
        var wsRawDataOpen = function () {
            console.log('Raw data: Connection is open at ', new Date());
        };
        var wsSaClusterOpen = function () {
            console.log('Samples per cluster: Connection is open at ', new Date());
        };

    // Websockets - Error
    // *****************************
        var wsErrorFunc = function (error) {
            console.log('WebSocket Error ', error);
        };

    // Websockets - Received messages
    // *****************************
        // Centroid
            var wsCentroidsMsn = function (e) {
                console.log( 'Server centroids: ', e.data, ' at ', new Date() );

                OutputModel.centroids = ( JSON.parse( JSON.parse(e.data).message ) );
                updateCentroids();
            };

        // Raw data
            var counter = 0;
            var wsRawDataMsn = function (e) {
                //console.log('Server Raw data: ', e.data, ' at ', new Date());

                var n = 100;

                OutputModel.rawData.unshift( JSON.parse( JSON.parse(e.data).message ) );
                if ( OutputModel.rawData.length > n )
                    OutputModel.rawData.length = n;

                counter++;
                if ( counter % n == 0 ) {
                    counter = 0;
                    updateRawData();
                }

            }

        // Cost
            var wsCostMsg = function (e) {
                console.log( 'Server cost: ', e.data, ' at ', new Date() );

                var msg = ( JSON.parse( JSON.parse(e.data).message ) );
                updateCostPlot( msg )
                // tick( msg );

                // console.log( msg )
            };

        // Samples per cluster
            var wsSaClusterMsg = function (e) {
                console.log( 'Server clusters stats: ', e.data, ' at ', new Date() );

/* ClusteringStats( nSa: Int,
 nSaPerCluster:Array[Int],
 nSaIndex:Double,
 meanDistPerCluster:Array[Double]
 )*/
                var msg = ( JSON.parse( JSON.parse(e.data).message ) );
                OutputModel.saHist = msg.nSaPerCluster;

                updateSaHist( msg.nSaPerCluster );
                updateSaClusterIndex( msg.nSaIndex );
                updateMeanDistPlot( msg.meanDistPerCluster );
                console.log( msg );
            };




// -------------------------------------------------------------------
//          VISUALIZACIÓN - Scatterplot
// -------------------------------------------------------------------

    // Datos de entrada
        var minX = d3.min( OutputModel.centroids, function(d) { return d[0]; } );
        var minY = d3.min( OutputModel.centroids, function(d) { return d[1]; } );
        var maxX = d3.max( OutputModel.centroids, function(d) { return d[0]; } );
        var maxY = d3.max( OutputModel.centroids, function(d) { return d[1]; } );

    // Configuración del área de dibujado
        // Márgenes
        var margin = {top: 20, right: 40, bottom: 30, left: 40},
        // Tamaño del elemento SVG
            outputW  = 600,  outputH = 500,
        // Área asignada a la gráfica
            w = outputW  - margin.left - margin.right,
            h = outputH - margin.top  - margin.bottom;
        // Tamaño de los puntos del scatterplot
        var radius = 5;

    // Creación del elemento SVG y el contenedor para el scatterplot
        var outputSvg   = d3.select("#outputChart").append("svg").attr( "width", outputW ).attr( "height", outputH );
        var outputChart = outputSvg.append("g").attr( "transform", "translate(" + margin.left + ", " + margin.top + ")" );

    // Scalado de datos
        var cxScale = d3.scale.linear().domain( [minX, maxX] ).range( [radius, w-radius] );
        var cyScale = d3.scale.linear().domain( [minY, maxY] ).range([h-radius, radius]);

    // Ejes
        var xAxisScale  = d3.scale.linear().domain([cxScale.invert(0), cxScale.invert(w)]).range([0, w]);
        var xAxis       = d3.svg.axis().scale( xAxisScale );

        var yAxisScale  = d3.scale.linear().domain([cyScale.invert(h), cyScale.invert(0)]).range([h, 0]);
        var yAxis       = d3.svg.axis().scale( yAxisScale ).orient("left");

        outputChart.append("g").attr("class", "outputY axis").call(yAxis);
        outputChart.append("g").attr("class", "outputX axis").attr("transform", "translate(0," + h + ")").call(xAxis);

    // Inicializamos gráfica scatterplot
        outputChart.selectAll("circle")
            .data( OutputModel.centroids )
            .enter()
            .append("circle")
            .attr("cx", function(d) {
                return cxScale( d[0] );
            })
            .attr("cy", function(d) {
                return cyScale( d[1] );
            })
            .attr("fill", function(d,i){ return OutputModel.colors(i) } )
            .attr("r", radius )
            .attr("class", "centroid") ;

    // Actualizamos centroides
    function updateCentroids() {

        outputChart.selectAll(".centroid").remove();
        outputChart.selectAll(".centroid")
            .data( OutputModel.centroids )
            .enter()
            .append("circle")
            .attr("cx", function(d) {
                return cxScale( d[0] );
            })
            .attr("cy", function(d) {
                return cyScale( d[1] );
            })
            .attr("r", 2*radius )
            .attr("class", "centroid")
            .attr("fill", function(d,i){ return OutputModel.colors(i) } );
    }

    // Actualizamos raw data
    function updateRawData() {

        // Borrado de datos antiguos
            outputChart.selectAll( ".rawdata" ).remove();

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
            cxScale.domain( [minVx, maxVx] );
            cyScale.domain( [minVy, maxVy] );

            yAxisScale.domain([cyScale.invert(h), cyScale.invert(0)]);
            xAxisScale.domain([cxScale.invert(0), cxScale.invert(w)]);

            outputSvg.select(".outputY.axis").transition().duration(100).call(yAxis);
            outputSvg.select(".outputX.axis").transition().duration(100).call(xAxis);

        // Nuevos datos
            outputChart.selectAll(".rawdata")
                .data( OutputModel.rawData )
                .enter()
                .append("circle")
                .attr("cx", function(d) {
                    return cxScale( d[0] );
                })
                .attr("cy", function(d) {
                    return cyScale( d[1] );
                })
                .attr("r", radius )
                .attr("class", "rawdata")
                .attr("fill", "yellow") ;
    }


// -------------------------------------------------------------------
//          VISUALIZACIÓN - Cost plot
// -------------------------------------------------------------------

    var VisCostPlot = {}; // Declare empty global object

    // Área de dibujado
        // SVG
        VisCostPlot.divId  = "#errorPlot";
        VisCostPlot.width  = parseInt( d3.selectAll( VisCostPlot.divId ).style("width") );
        VisCostPlot.height = parseInt( d3.selectAll( VisCostPlot.divId ).style("height") );
        VisCostPlot.svg    = d3.select( VisCostPlot.divId ).append("svg")
                                .attr("width",  VisCostPlot.width )
                                .attr("height", VisCostPlot.height );

        // CHART
        VisCostPlot.margin = { top: 20, right: 20, bottom: 20, left: 40 };
        VisCostPlot.w      = VisCostPlot.width  - VisCostPlot.margin.left - VisCostPlot.margin.right;
        VisCostPlot.h      = VisCostPlot.height - VisCostPlot.margin.top  - VisCostPlot.margin.bottom;
        VisCostPlot.chart  = VisCostPlot.svg.append("g").attr("transform",
                              "translate(" + VisCostPlot.margin.left + ", " + VisCostPlot.margin.top + ")");

    // Scalas
        VisCostPlot.x = d3.scale.linear().domain([0, OutputModel.timeWindow - 1])
                                          .range([0, VisCostPlot.w ]);

        VisCostPlot.y = d3.scale.linear().domain([-1, 2000])
                                          .range([ VisCostPlot.h, 0]);

    // Linea
        VisCostPlot.line = d3.svg.line().x( function(d, i) { return VisCostPlot.x(i); } )
                                        .y( function(d, i) { return VisCostPlot.y(d); } );

    // Clip
        VisCostPlot.chart.append("defs").append("clipPath")
                        .attr("id", "clip")
                        .append("rect")
                        .attr("width",  VisCostPlot.w )
                        .attr("height", VisCostPlot.h );

    // Axis
        VisCostPlot.xaxis = d3.svg.axis().scale( VisCostPlot.x ).orient("bottom");

        VisCostPlot.chart.append("g").attr("class", "x axis")
            .attr("transform", "translate(0," + VisCostPlot.y(0) + ")").call( VisCostPlot.xaxis );

        VisCostPlot.yaxis = d3.svg.axis().scale( VisCostPlot.y ).orient("left");

        VisCostPlot.chart.append("g").attr("class", "y axis").call( VisCostPlot.yaxis );

    // Paths
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

// -------------------------------------------------------------------
//          VISUALIZACIÓN - Histogram
// -------------------------------------------------------------------

    var VisSaClusterHist = {}; // Declare empty global object

    // Área de dibujado
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

    // Escala para los valores
        VisSaClusterHist.scale = d3.scale.linear().domain([0, 1]).range([0, VisSaClusterHist.h]);

    // Axis
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


