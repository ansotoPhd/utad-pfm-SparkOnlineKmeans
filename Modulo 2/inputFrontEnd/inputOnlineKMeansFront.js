
// -------------------------------------------------------------------
//          MODEL
// -------------------------------------------------------------------

    var InputModel = {}; // Declare empty global object

    InputModel.wsConnection = null;
    InputModel.wsUrl        = 'ws://localhost:7080/v2/broker/';
    InputModel.wsConnected  = false;
    InputModel.wsMsn        = { topic : "dataGenModel", message : "" };

    InputModel.lastId        = 2;
    InputModel.selectedGauss = null;

    InputModel.dataModel    = [
                                { id:0, mean: [-5,-5], cov: [[1,0],[0,1]] },
                                { id:1, mean: [5,5],   cov: [[1,0],[0,1]] },
                                { id:2, mean: [0,0],   cov: [[1,0],[0,1]] }
                              ];

    InputModel.dataModel.map( calcEllipsis )


    function calcEllipsis(d){
        var ellipsis = [];

        d.cor = d.cov[0][1] / ( Math.sqrt(d.cov[0][0])*Math.sqrt(d.cov[1][1]) );

        ellipsis[0] = errorEllipse(Math.sqrt(d.cov[0][0]),  Math.sqrt(d.cov[1][1]), d.cor, {x: d.mean[0], y: d.mean[1] }, 0.99);
        ellipsis[1] = errorEllipse(Math.sqrt(d.cov[0][0]),  Math.sqrt(d.cov[1][1]), d.cor, {x: d.mean[0], y: d.mean[1] }, 0.75);
        ellipsis[2] = errorEllipse(Math.sqrt(d.cov[0][0]),  Math.sqrt(d.cov[1][1]), d.cor, {x: d.mean[0], y: d.mean[1] }, 0.5);

        d.ellipsis = ellipsis;
        return d;
    }

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

            // Composing data to send
                var data = InputModel.dataModel.map( function(d){ return {mean:d.mean,cov: d.cov} } );
            // Data to Json string
                InputModel.wsMsn.message = JSON.stringify( data );
            // Message in Json format
                var msn = JSON.stringify( InputModel.wsMsn );
                console.log( msn);
            // Sending message through websocket
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

        var inputChart   = inputSvg.append("g").attr("id", "chart")
                           .attr( "transform", "translate(" + chartMargin.left + ", " + chartMargin.top + ")" );

    // Scalado de datos
        var inputXScale = d3.scale.linear().domain([0,1]).range([0, wChart]);
        var inputYScale = d3.scale.linear().domain([0,1]).range([hChart, 0]);

    // Ejes
        // var inputXAxisScale = d3.scale.linear().domain([0,1]).range([0, wChart]);
        var inputXAxis      = d3.svg.axis().scale( inputXScale ).tickSize(-hChart);

        // var inputYAxisScale = d3.scale.linear().domain([0,1]).range([hChart, 0]);
        var inputYAxis = d3.svg.axis().scale( inputYScale ).tickSize(-wChart).orient("left");

        inputChart.append("g").attr("class", "inputY axis").call(inputYAxis);
        inputChart.append("g").attr("class", "inputX axis").attr("transform", "translate(0," + hChart + ")").call(inputXAxis);

    // Initialization
        var gaussGroups = null;
        updateVisualization();
        unSelectGauss();
        // Buttons
        d3.select("#wbInputClose").attr('disabled', 1 );
        d3.select("#wbInputSendData").attr('disabled', 1 );
        d3.select("#wbInputConnection").attr('disabled', null );


    function updateVisualization(){

        if( gaussGroups != null )
            gaussGroups.remove();

        var minX = d3.min( InputModel.dataModel, function(d) { return d.mean[0] - 3*Math.sqrt( d.cov[0][0] ); } );
        var minY = d3.min( InputModel.dataModel, function(d) { return d.mean[1] - 3*Math.sqrt( d.cov[1][1] ); } );
        var maxX = d3.max( InputModel.dataModel, function(d) { return d.mean[0] + 3*Math.sqrt( d.cov[0][0] ); } );
        var maxY = d3.max( InputModel.dataModel, function(d) { return d.mean[1] + 3*Math.sqrt( d.cov[1][1] ); } );

        var minV = d3.min( [minX, minY]);
        var maxV = d3.max( [maxX, maxY ]);

        inputXScale.domain( [minV, maxV] );
        inputYScale.domain( [minV, maxV] );

        inputSvg.select(".inputY.axis").transition().duration(100).call(inputYAxis);
        inputSvg.select(".inputX.axis").transition().duration(100).call(inputXAxis);
        

        gaussGroups = inputChart.selectAll("a").data( InputModel.dataModel );
        var gaussGroupsEnter =
            gaussGroups.enter()
                .append("g")
                .attr("id", function(d){
                    return "gauss-"+ d.id ;
                });

        gaussGroupsEnter
            .append('ellipse')
            .attr('class', 'q-ellipse-99')
            .attr('rx', function(d) { return Math.abs( inputXScale( d.ellipsis[0].rx ) - inputXScale(0) ); }  )
            .attr('ry', function(d) { return Math.abs( inputYScale( d.ellipsis[0].ry ) - inputYScale(0) ); }  )
            .attr('transform', function(d) { return '' +
                'translate(' + inputXScale(d.ellipsis[0].cx) + ',' + inputYScale(d.ellipsis[0].cy) +
                ')rotate(' + d.ellipsis[0].orient + ')'; } )
            .attr("fill", "yellow")
            .attr("opacity",0.5 )
            .on("click", function(d){ selectGaussVis(d.id); d3.event.stopPropagation(); } );


        gaussGroupsEnter
            .append('ellipse')
            .attr('class', 'q-ellipse-75')
            .attr('rx', function(d) { return Math.abs( inputXScale( d.ellipsis[1].rx ) - inputXScale(0) ); }  )
            .attr('ry', function(d) { return Math.abs( inputYScale( d.ellipsis[1].ry ) - inputYScale(0) ); }  )
            .attr('transform', function(d) { return '' +
                'translate(' + inputXScale(d.ellipsis[1].cx) + ',' + inputYScale(d.ellipsis[1].cy) +
                ')rotate(' + d.ellipsis[1].orient + ')'; } )
            .attr("fill", "orange")
            .attr("opacity",0.75 )
            .on("click", function(d){ selectGaussVis(d.id); d3.event.stopPropagation(); } );

        gaussGroupsEnter
            .append('ellipse')
            .attr('class', 'q-ellipse-50')
            .attr('rx', function(d) { return Math.abs( inputXScale( d.ellipsis[2].rx ) - inputXScale(0) ); }  )
            .attr('ry', function(d) { return Math.abs( inputYScale( d.ellipsis[2].ry ) - inputYScale(0) ); }  )
            .attr('transform', function(d) { return '' +
                'translate(' + inputXScale(d.ellipsis[2].cx) + ',' + inputYScale(d.ellipsis[2].cy) +
                ')rotate(' + d.ellipsis[2].orient + ')'; } )
            .attr("fill", "red")
            .attr("opacity",0.90 )
            .on("click", function(d){ selectGaussVis(d.id); d3.event.stopPropagation(); } );

        if( InputModel.selectedGauss != null )
            selectGaussVis( InputModel.selectedGauss )

    }

    // Control de componentes Gaussianas

    function selectGaussVis( id ){

        // Remove previous selection ellipsis if exists
        if( InputModel.selectedGauss != null )
            d3.selectAll(".selected").remove();

        // Append new selection ellipsis --> Class: selected
        d3.select( "#gauss-"+id )
          .append('ellipse')
            .attr('class', 'selected')
            .attr('rx', function(d) { return Math.abs( inputXScale( d.ellipsis[0].rx ) - inputXScale(0) ); }  )
            .attr('ry', function(d) { return Math.abs( inputYScale( d.ellipsis[0].ry ) - inputYScale(0) ); }  )
            .attr('transform', function(d) { return '' +
                'translate(' + inputXScale(d.ellipsis[0].cx) + ',' + inputYScale(d.ellipsis[0].cy) +
                ')rotate(' + d.ellipsis[0].orient + ')'; } )
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

        // Enable inputs. Enable 'remove gaussian' button
        d3.selectAll(".disabledElem").attr('disabled', null );
        d3.selectAll(".removeGauss").attr('disabled', null );

        // Update inputs values
        for ( var i in InputModel.dataModel ) {
            if ( id == InputModel.dataModel[i].id ) {

                console.log( InputModel.dataModel);

                document.getElementById('gauss_xMean').value = InputModel.dataModel[i].mean[0];
                document.getElementById('gauss_yMean').value = InputModel.dataModel[i].mean[1];
                document.getElementById('gauss_xStd').value  = Math.sqrt( InputModel.dataModel[i].cov[0][0] );
                document.getElementById('gauss_yStd').value  = Math.sqrt( InputModel.dataModel[i].cov[1][1] );
                document.getElementById('cor').value =  InputModel.dataModel[i].cov[1][0]/
                                                        Math.sqrt( InputModel.dataModel[i].cov[0][0] ) /
                                                        Math.sqrt( InputModel.dataModel[i].cov[1][1] );

                break; //Stop this loop, we found it!
            }
        }
    }

    function unSelectGauss(){
        console.log( "Unselected " );

        // Disabling inputs
        d3.selectAll(".disabledElem").attr('disabled', 1 );

        // Remove selection ellipsis
        d3.selectAll(".selected").remove();

        InputModel.selectedGauss = null;
    }

    document.getElementById('newGauss').addEventListener('click', newGauss );

    function newGauss(){
        console.log( "Creating new gauss component " );

        InputModel.lastId++;

        var gaussian = calcEllipsis( { id:InputModel.lastId, P:0.33, mean:[0,0], cov:[[1,0],[0,1]]} );

        InputModel.dataModel.push( gaussian );

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

    /*  Gaussian parameter change
       -------------------------------------------------------- */

    // Mean x
    d3.select("#gauss_xMean").on("input", function() {
        changeGaussValue( "gauss_xMean",+this.value ); });
    // Mean y
    d3.select("#gauss_yMean").on("input", function() {
        changeGaussValue( "gauss_yMean",+this.value ); });
    // Std x
    d3.select("#gauss_xStd").on("input", function() {
        changeGaussValue( "gauss_xStd",+this.value ); });
    // Std y
    d3.select("#gauss_yStd").on("input", function() {
        changeGaussValue( "gauss_yStd",+this.value ); });
    // Corr
    d3.select("#cor").on("input", function() {
        changeGaussValue( "cor",+this.value ); });



    function changeGaussValue( valueCode, value ){
        console.log( "Changing Gaussian value" );

        var id;
        id = InputModel.selectedGauss;

        for ( var i=0; i < InputModel.dataModel.length ; i++ ) {
            if (id == InputModel.dataModel[i].id) {

                switch (valueCode) {

                    case "gauss_xMean":
                        InputModel.dataModel[i].mean[0] = value;
                        break;

                    case "gauss_yMean":
                        InputModel.dataModel[i].mean[1] = value;
                        break;

                    case "gauss_xStd":
                        var m = [ [ value*value,
                                    InputModel.dataModel[i].cor*value*Math.sqrt(InputModel.dataModel[i].cov[1][1] )],
                                  [ InputModel.dataModel[i].cor*value*Math.sqrt(InputModel.dataModel[i].cov[1][1] ) ,
                                    InputModel.dataModel[i].cov[1][1]] ];
                        InputModel.dataModel[i].cov = m;
                        break;

                    case "gauss_yStd":
                        var m = [ [ InputModel.dataModel[i].cov[0][0],
                                    InputModel.dataModel[i].cor*value*Math.sqrt(InputModel.dataModel[i].cov[0][0]) ],
                                  [ InputModel.dataModel[i].cor*value*Math.sqrt(InputModel.dataModel[i].cov[0][0]),
                                    value*value] ];
                        InputModel.dataModel[i].cov = m;
                        break;

                    case "cor":
                        var m = [ [ InputModel.dataModel[i].cov[0][0],
                                    value*Math.sqrt(InputModel.dataModel[i].cov[0][0]) * Math.sqrt(InputModel.dataModel[i].cov[1][1])],
                                [   value*Math.sqrt(InputModel.dataModel[i].cov[0][0]) * Math.sqrt(InputModel.dataModel[i].cov[1][1]),
                                    InputModel.dataModel[i].cov[1][1] ] ];

                        InputModel.dataModel[i].cov = m;
                        break;
                }
                var aux = InputModel.dataModel[i];
                InputModel.dataModel[i] = calcEllipsis(aux);

                break; //Stop this loop, we found it!
            }
        }

        updateVisualization();
    }
