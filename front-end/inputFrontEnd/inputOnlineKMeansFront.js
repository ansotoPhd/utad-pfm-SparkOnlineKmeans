/**
 * Created by asoriano on 19/12/15.
 */


// -------------------------------------------------------------------
//          MODEL
// -------------------------------------------------------------------

    var InputModel = {}; // Declare empty global object

        InputModel.wsConnection = null;
        InputModel.wsUrl        = 'ws://localhost:7080/v2/broker/';
        InputModel.wsConnected  = false;
        InputModel.wsMsn        = { topic : "model2", message : "" };

        InputModel.lastId       = 2;
        InputModel.covMatrix    = [[1,0],[0,1]];
        InputModel.dataModel    = [
                                    { id:0, P:0.33, mean:[-5,-5], cov:InputModel.covMatrix },
                                    { id:1, P:0.33, mean:[5,5],   cov:InputModel.covMatrix },
                                    { id:2, P:0.33, mean:[0,0],   cov:InputModel.covMatrix }
                                  ];

        InputModel.selectedGauss = null;



// -------------------------------------------------------------------
//         CONNECTION
// -------------------------------------------------------------------

    //  Boton de conexión al websocket --> Función
    // ***********************************************************
        document.getElementById('wbInputConnection').addEventListener('click', wbInputConnectionFunc);

        function wbInputConnectionFunc(){
            console.log( 'Trying to connect to socket' );

            InputModel.wsConnection = new WebSocket( InputModel.wsUrl );
            InputModel.wsConnection.onopen    = wsModelOpen;
            InputModel.wsConnection.onerror   = wsModelError;
        }

        // Apertura del socket
        var wsModelOpen = function () {
            console.log( 'Model: Connection is open at ', new Date() );

            InputModel.wsConnected = true;

            d3.select("#wbInputClose").attr('disabled', null );
            d3.select("#wbInputSendData").attr('disabled', null );
            d3.select("#wbInputConnection").attr('disabled', 1 );
        };

        // Error en el socket
        var wsModelError = function (error) {
            console.log( 'WebSocket Error ', error );
            d3.select("#wbInputClose").attr('disabled', 1 );
            d3.select("#wbInputSendData").attr('disabled', 1 );
            d3.select("#wbInputConnection").attr('disabled', null );
            InputModel.wsConnected = false;
        };

    // Boton de desconexión al websocket
    // ***********************************************************
        document.getElementById('wbInputClose').addEventListener('click', wbInputCloseFunc);
        function wbInputCloseFunc(){
            console.log('Closing WebSocket: Model');

            InputModel.wsConnection.close();
            InputModel.wsConnected = false;
            d3.select("#wbInputClose").attr('disabled', 1 );
            d3.select("#wbInputSendData").attr('disabled', 1 );
            d3.select("#wbInputConnection").attr('disabled', null );
        }

    // Boton de enviar datos por websocket
    // ***********************************************************
        document.getElementById('wbInputSendData').addEventListener('click', wbInputSendFunc);

        function wbInputSendFunc(){
            console.log( 'Sending data:' );

            InputModel.wsMsn.message = JSON.stringify( InputModel.dataModel );

            var msn = JSON.stringify( InputModel.wsMsn );
            console.log( msn);

            InputModel.wsConnection.send( msn );

        }





// -------------------------------------------------------------------
//          VISUALIZACIÓN
// -------------------------------------------------------------------

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
        var inputSvg     = d3.select("#inputVisualization").append("svg")
                             .attr( "width", width ).attr( "height", height )
                             .on("click", unSelectGauss );

        var inputChart   = inputSvg.append("g").attr( "transform", "translate(" + chartMargin.left + ", " + chartMargin.top + ")" );

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


    var gaussGroups = null;
    updateVisualization();
    unSelectGauss();
    d3.select("#wbInputClose").attr('disabled', 1 );
    d3.select("#wbInputSendData").attr('disabled', 1 );
    d3.select("#wbInputConnection").attr('disabled', null );

    function updateVisualization(){

        if( gaussGroups != null )
            gaussGroups.remove();

        var minX = d3.min( InputModel.dataModel, function(d) { return d.mean[0] - 3*d.cov[0][0]; } );
        var minY = d3.min( InputModel.dataModel, function(d) { return d.mean[1] - 3*d.cov[1][1]; } );
        var maxX = d3.max( InputModel.dataModel, function(d) { return d.mean[0] + 3*d.cov[0][0]; } );
        var maxY = d3.max( InputModel.dataModel, function(d) { return d.mean[1] + 3*d.cov[1][1]; } );

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

        gaussGroups          = inputChart.selectAll("a").data( InputModel.dataModel );
        var gaussGroupsEnter = gaussGroups.enter().append("g")
            //.call(
            //    d3.behavior.drag()
            //        .on('drag', moveRect).origin(function () {
            //            var tc = d3.select(this).data()[0].mean;
            //            return { x: inputXScale( tc[0] ), y: inputYScale( tc[1] ) };
            //        }))
            .attr("id", function(d,i){
                return "gauss-"+ d.id ;
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
            .attr("fill", "yellow")
            .on("click", function(d){ selectGaussVis(d.id); d3.event.stopPropagation(); } );

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
            .attr("fill", "orange")
            .on("click", function(d){ selectGaussVis(d.id); d3.event.stopPropagation(); } );

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
            .attr("fill", "red")
            .on("click", function(d){ selectGaussVis(d.id); d3.event.stopPropagation(); } );

        if( InputModel.selectedGauss != null )
            selectGaussVis( InputModel.selectedGauss )

    }

    // Control de componentes Gaussianas

        function moveRect() {

            selectGaussVis( d3.select(this).data()[0].id );

            document.getElementById('gauss_xMean').value = inputXScale.invert( d3.event.x );
            document.getElementById('gauss_yMean').value = inputYScale.invert( d3.event.y );


        }

    function selectGaussVis( id ){

        if( InputModel.selectedGauss != null )
            d3.selectAll(".selected").remove();

        d3.select( "#gauss-"+id )
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
            .attr("class", "selected")
            .style("stroke", "red")
            .style("stroke-width", 5)
            .style("stroke-dasharray", ("10,3"))
            .style("fill", "none");

        selectGauss( id );
    }

    function selectGauss( id ){
        console.log( "Selected " + id );

        // Update model
        InputModel.selectedGauss = id;

        // Enable inputs
        d3.selectAll(".disabledElem").attr('disabled', null );
        d3.selectAll(".removeGauss").attr('disabled', null );

        // Update inputs values
        for ( var i in InputModel.dataModel ) {
            if ( InputModel.dataModel[i].id == id ) {

                document.getElementById('gauss_xMean').value = InputModel.dataModel[i].mean[0];
                document.getElementById('gauss_yMean').value = InputModel.dataModel[i].mean[1];
                break; //Stop this loop, we found it!
            }
        }
    }

    function unSelectGauss(){
        console.log( "Unselected " );
        d3.selectAll(".disabledElem").attr('disabled', 1 );
        d3.selectAll(".selected").remove();

        InputModel.selectedGauss = null;
    }

    document.getElementById('newGauss').addEventListener('click', newGauss );

    function newGauss(){
        console.log( "Creating new gauss component " );

        InputModel.lastId++;

        InputModel.dataModel.push( { id:InputModel.lastId, P:0.33, mean:[0,0], cov:InputModel.covMatrix } );

        updateVisualization();
        selectGaussVis( InputModel.lastId );

    }

    document.getElementById('removeGauss').addEventListener('click', removeGauss );

    function removeGauss(){
        console.log( "Removing gauss component " );

        var id = InputModel.selectedGauss;

        if( InputModel.dataModel.length >1 ) {
            for (var i in InputModel.dataModel) {
                if (InputModel.dataModel[i].id == id) {
                    InputModel.dataModel.splice(i, 1);
                    break; //Stop this loop, we found it!
                }
            }
            unSelectGauss();
            updateVisualization();

        }else{
            console.log( "There must be at least one component." )
        }
    }


    d3.select("#gauss_xMean").on("input", function() {
        changeGaussValue( "gauss_xMean",+this.value );
    });
    d3.select("#gauss_yMean").on("input", function() {
        changeGaussValue( "gauss_yMean",+this.value );
    });

    function changeGaussValue( valueCode, value ){
        console.log( "Changing Gaussian value" );

        var id = InputModel.selectedGauss;

        for ( var i in InputModel.dataModel ) {
            if ( InputModel.dataModel[i].id == id ) {

                switch( valueCode ) {
                    case "gauss_xMean":
                        InputModel.dataModel[i].mean[0] = value;
                        break;
                    case "gauss_yMean":
                        InputModel.dataModel[i].mean[1] = value;
                        break;
                }
                break; //Stop this loop, we found it!
            }
        }

        updateVisualization();
    }