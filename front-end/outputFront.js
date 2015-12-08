/**
 * Created by asoriano on 7/12/15.
 */

// -------------------------------------------------------------------
//          WEBSOCKETS
// -------------------------------------------------------------------

    // Conexión mediante websocket
    var wsCentroids = null
    var wsRawData   = null

    // Boton de conexión al websocket --> Función
    document.getElementById('wbConnection').addEventListener('click', wbConnectionFunc);
    function wbConnectionFunc(){

        console.log('Trying to connect to socket');

        wsCentroids= new WebSocket('ws://localhost:7080/v2/broker/?topics=centroids4');
        wsCentroids.onopen    = wsCentroidsOpen;
        wsCentroids.onerror   = wsErrorFunc;
        wsCentroids.onmessage = wsCentroidsMsn;

        wsRawData = new WebSocket('ws://localhost:7080/v2/broker/?topics=rawData2');
        wsRawData.onopen    = wsRawDataOpen;
        wsRawData.onerror   = wsErrorFunc;
        wsRawData.onmessage = wsRawDataMsn;
    }

    // Boton de desconexión al websocket
    document.getElementById('wbClose').addEventListener('click', wbCloseFunc);
    function wbCloseFunc(){

        console.log('Closing WebSocket');

        wsCentroids.close();
        wsRawData.close();
    }

    // Apertura del socket
    var wsCentroidsOpen = function () {
        console.log('Centroids: Connection is open at ', new Date());
    };
    // Error en el socket
    var wsErrorFunc = function (error) {
        console.log('WebSocket Error ', error);
    };
    // Log messages from the server
    var wsCentroidsMsn = function (e) {
        console.log('Server centroids: ', e.data, ' at ', new Date());
        centroids = ( JSON.parse( JSON.parse(e.data).message ) );
        updateCentroids();
    };

    // Apertura del socket
    var wsRawDataOpen = function () {
        console.log('Data: Connection is open at ', new Date());
    };
    // Log messages from the server
    var wsRawDataMsn = function (e) {
        console.log('Server data: ', e.data, ' at ', new Date());
        rawdata.unshift( JSON.parse( JSON.parse(e.data).message ) );
        if( rawdata.length > 50 )
            rawdata.length = 50;
        updateRawData();
    };


// -------------------------------------------------------------------
//          VISUALIZACIÓN
// -------------------------------------------------------------------

    // Datos de entrada
        var centroids = [[0,0],[-3,-1],[3,1]];
            var minX = d3.min( centroids, function(d) { return d[0]; } );
            var minY = d3.min( centroids, function(d) { return d[1]; } );
            var maxX = d3.max( centroids, function(d) { return d[0]; } );
            var maxY = d3.max( centroids, function(d) { return d[1]; } );
        var rawdata   = [];

    // Configuración del área de dibujado
        // Márgenes
        var margin = {top: 20, right: 150, bottom: 30, left: 40},
        // Tamaño del elemento SVG
            width  = 800,  height = 500,
        // Área asignada a la gráfica
            w = width  - margin.left - margin.right,
            h = height - margin.top  - margin.bottom;
        // Tamaño de los puntos del scatterplot
        var radius = 10;

    // Creación del elemento SVG y el contenedor para el scatterplot
        var svg = d3.select("#outputChart").append("svg").attr( "width", width ).attr( "height", height );
        var chart = svg.append("g").attr( "transform", "translate(" + margin.left + ", " + margin.top + ")" );

    // Scalado de datos
        var cxScale = d3.scale.linear().domain( [minX, maxX] ).range( [radius, w-radius] );
        var cyScale = d3.scale.linear().domain( [minY, maxY] ).range([h-radius, radius]);

    // Ejes
        var xAxisScale = d3.scale.linear().domain([cxScale.invert(0), cxScale.invert(w)]).range([0, w]);
        var xAxis = d3.svg.axis().scale( xAxisScale );

        var yAxisScale = d3.scale.linear().domain([cyScale.invert(h), cyScale.invert(0)]).range([h, 0]);
        var yAxis = d3.svg.axis().scale( yAxisScale ).orient("left");

        chart.append("g").attr("class", "y axis").call(yAxis);
        chart.append("g").attr("class", "x axis").attr("transform", "translate(0," + h + ")").call(xAxis);

    // Inicializamos gráfica scatterplot
        chart.selectAll("circle")
            .data(centroids)
            .enter()
            .append("circle")
            .attr("cx", function(d) {
                return cxScale( d[0] );
            })
            .attr("cy", function(d) {
                return cyScale( d[1] );
            })
            .attr("r", radius )
            .attr("class", "centroid") ;

// -------------------------------------------------------------------
//          VISUALIZACIÓN - Actualización de datos
// -------------------------------------------------------------------

    // Actualizamos centroides
        function updateCentroids() {

            chart.selectAll(".centroid").remove();
            chart.selectAll(".centroid")
                .data(centroids)
                .enter()
                .append("circle")
                .attr("cx", function(d) {
                    return cxScale( d[0] );
                })
                .attr("cy", function(d) {
                    return cyScale( d[1] );
                })
                .attr("r", radius )
                .attr("class", "centroid")
                .attr("fill", "black") ;
        }

    // Actualizamos raw data
        function updateRawData() {

            chart.selectAll(".rawdata").remove();

            // Procesado de datos
            var minX = d3.min( rawdata, function(d) { return d[0]; } );
            var minY = d3.min( rawdata, function(d) { return d[1]; } );
            var maxX = d3.max( rawdata, function(d) { return d[0]; } );
            var maxY = d3.max( rawdata, function(d) { return d[1]; } );

            // Actualización de escalas y ejes
            cxScale.domain( [minX, maxX] );
            cyScale.domain( [minY, maxY] );

            yAxisScale.domain([cyScale.invert(h), cyScale.invert(0)]);
            xAxisScale.domain([cxScale.invert(0), cxScale.invert(w)]);

            svg.select(".y.axis").transition().duration(100).call(yAxis);
            svg.select(".x.axis").transition().duration(100).call(xAxis);

            chart.selectAll(".rawdata")
                .data(rawdata)
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

