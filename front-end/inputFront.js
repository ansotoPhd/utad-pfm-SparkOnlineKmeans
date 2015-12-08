/**
 * Created by asoriano on 7/12/15.
 */


// -------------------------------------------------------------------
//          WEBSOCKETS
// -------------------------------------------------------------------

    // Conexión mediante websocket
        var wsModel = null

        var modelMsn = { topic : "model", message : "" };
        var model = [{p:0, mean:[1,1]},{p:0, mean:[1,1]},{p:0, mean:[1,1]} ];

    // Boton de conexión al websocket --> Función
        document.getElementById('wbInputConnection').addEventListener('click', wbInputConnectionFunc);
        function wbInputConnectionFunc(){
            console.log('Trying to connect to socket');
            wsModel = new WebSocket('ws://localhost:7080/v2/broker/');
                wsModel.onopen    = wsModelOpen;
                wsModel.onerror   = wsModelError;
                // wsModel.onmessage = wsModelMsn;
        }

        // Apertura del socket
            var wsModelOpen = function () {
                console.log('Model: Connection is open at ', new Date());
            };
        // Error en el socket
            var wsModelError = function (error) {
                console.log('WebSocket Error ', error);
            };

    // Boton de desconexión al websocket
        document.getElementById('wbInputClose').addEventListener('click', wbInputCloseFunc);
        function wbInputCloseFunc(){
            console.log('Closing WebSocket: Model');
            wsModel.close();
        }

    // Boton de enviar datos por websocket
        document.getElementById('wbInputSendData').addEventListener('click', wbInputSendFunc);
        function wbInputSendFunc(){
            console.log('Sending data:');

            model[0].p = document.getElementById('gauss0_P').value;
            model[1].p = document.getElementById('gauss1_P').value;
            model[2].p = document.getElementById('gauss2_P').value;

            model[0].mean[0] = document.getElementById('gauss0_xMean').value;
            model[0].mean[1] = document.getElementById('gauss0_yMean').value;

            model[1].mean[0] = document.getElementById('gauss1_xMean').value;
            model[1].mean[1] = document.getElementById('gauss1_yMean').value;

            model[2].mean[0] = document.getElementById('gauss2_xMean').value;
            model[2].mean[1] = document.getElementById('gauss2_yMean').value;

            modelMsn.message = JSON.stringify(model);

            console.log( JSON.stringify( modelMsn) )

            wsModel.send( JSON.stringify( modelMsn) )

        }





// -------------------------------------------------------------------
//          VISUALIZACIÓN
// -------------------------------------------------------------------

    // Datos de entrada
    var categoricalDist = [0.33,0.33,0.33];
    var covMatrix       = [[1,0],[0,1]]
    var gaussDists      = [ { mean:[-5,-5], cov:covMatrix},
                            { mean:[5,5],   cov:covMatrix},
                            { mean:[0,0],   cov:covMatrix}  ];

    // Configuración del área de dibujado
        // Márgenes
            var chartMargin   = {top: 20, right: 20, bottom: 30, left: 40},
                controlMargin = {top: 20, right: 20, bottom: 30, left: 520},
        // Tamaño del elemento SVG
            width  = 500,  height = 500,
        // Área asignada a la gráfica
            wChart = width  - chartMargin.left - chartMargin.right,
            hChart = height - chartMargin.top  - chartMargin.bottom
        // Area asignada al control
            wControl = width  - controlMargin.left - controlMargin.right,
            hControl = height - controlMargin.top  - controlMargin.bottom;

    // Creación del elemento SVG y el contenedor para el scatterplot
        var inputSvg     = d3.select("#inputChart").append("svg").attr( "width", width ).attr( "height", height );
        var inputChart   = inputSvg.append("g").attr( "transform", "translate(" + chartMargin.left + ", " + chartMargin.top + ")" );

        var gaussGroups = null;

    // Scalado de datos
        var inputXScale = d3.scale.linear().domain([0,1]).range([0, wChart]);
        var inputYScale = d3.scale.linear().domain([0,1]).range([hChart, 0]);

    // Ejes
        var inputXAxisScale = d3.scale.linear().domain([0,1]).range([0, wChart]);
        var inputXAxis = d3.svg.axis().scale( inputXAxisScale );

        var inputYAxisScale = d3.scale.linear().domain([0,1]).range([hChart, 0]);
        var inputYAxis = d3.svg.axis().scale( inputYAxisScale ).orient("left");

        inputChart.append("g").attr("class", "inputY axis").call(inputYAxis);
        inputChart.append("g").attr("class", "inputX axis").attr("transform", "translate(0," + hChart + ")").call(inputXAxis);

    // Inicializamos control
        d3.select("#gauss0_xMean").on("input", function() {
            update0(+this.value,0);
        });
        d3.select("#gauss0_yMean").on("input", function() {
            update0(+this.value,1);
        });
        d3.select("#gauss1_xMean").on("input", function() {
            update1(+this.value,0);
        });
        d3.select("#gauss1_yMean").on("input", function() {
            update1(+this.value,1);
        });
        d3.select("#gauss2_xMean").on("input", function() {
            update2(+this.value,0);
        });
        d3.select("#gauss2_yMean").on("input", function() {
            update2(+this.value,1);
        });
        function update0( value, comp ){
            gaussDists[0].mean[comp] = value;
            redraw();
        }
        function update1( value, comp ){
            gaussDists[1].mean[comp] = value;
            redraw();
        }
        function update2( value, comp ){
            gaussDists[2].mean[comp] = value;
            redraw();
        }

        function redraw(){
            gaussGroups.remove()
            update()

        }

        function update(){
            var minX = d3.min( gaussDists, function(d) { return d.mean[0] - 3*d.cov[0][0]; } );
            var minY = d3.min( gaussDists, function(d) { return d.mean[1] - 3*d.cov[1][1]; } );
            var maxX = d3.max( gaussDists, function(d) { return d.mean[0] + 3*d.cov[0][0]; } );
            var maxY = d3.max( gaussDists, function(d) { return d.mean[1] + 3*d.cov[1][1]; } );

            var minV = d3.min( [minX, minY]);
            var maxV = d3.max( [maxX, maxY ]);

            inputXScale.domain( [minV, maxV] );
            inputYScale.domain( [minV, maxV] );

            var minVal = d3.min( [inputXScale.invert(0), inputYScale.invert(hChart)]);
            var maxVal = d3.max( [inputXScale.invert(wChart), inputYScale.invert(0) ]);

            inputXAxisScale.domain([minVal, maxVal]);
            inputYAxisScale.domain([minVal, maxVal]);

            inputSvg.select(".inputY.axis").transition().duration(100).call(inputYAxis);
            inputSvg.select(".inputX.axis").transition().duration(100).call(inputXAxis);

            gaussGroups      = inputChart.selectAll("a").data( gaussDists );
            var gaussGroupsEnter = gaussGroups.enter().append("g")
                .attr("id", function(d,i){
                    return "gauss-"+i ;
                });

            gaussGroupsEnter
                .append("circle")
                .attr("cx", function(d) {
                    return inputXScale( d.mean[0] );
                })
                .attr("cy", function(d) {
                    return inputYScale( d.mean[1] );
                })
                .attr("r", function(d) {
                    return inputXScale( 3*d.cov[0][0] ) - inputXScale( 0 );
                })
                .attr("class", "3sig")
                .attr("fill", "yellow");

            gaussGroupsEnter
                .append("circle")
                .attr("cx", function(d) {
                    return inputXScale( d.mean[0] );
                })
                .attr("cy", function(d) {
                    return inputYScale( d.mean[1] );
                })
                .attr("r", function(d) {
                    return inputXScale( 2*d.cov[0][0] ) - inputXScale( 0 );
                })
                .attr("class", "2sig")
                .attr("fill", "orange");

            gaussGroupsEnter
                .append("circle")
                .attr("cx", function(d) {
                    return inputXScale( d.mean[0] );
                })
                .attr("cy", function(d) {
                    return inputYScale( d.mean[1] );
                })
                .attr("r", function(d) {
                    return inputXScale( d.cov[0][0] ) - inputXScale( 0 );
                })
                .attr("class", "1sig")
                .attr("fill", "red");

        }

    document.getElementById('gauss0_xMean').value = gaussDists[0].mean[0];
    document.getElementById('gauss0_yMean').value = gaussDists[0].mean[1];
    document.getElementById('gauss1_xMean').value = gaussDists[1].mean[0];
    document.getElementById('gauss1_yMean').value = gaussDists[1].mean[1];
    document.getElementById('gauss2_xMean').value = gaussDists[2].mean[0];
    document.getElementById('gauss2_yMean').value = gaussDists[2].mean[1];
    update();