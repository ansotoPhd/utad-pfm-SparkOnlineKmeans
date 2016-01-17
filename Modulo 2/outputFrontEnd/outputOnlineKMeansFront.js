
// -------------------------------------------------------------------
//          MODEL
// -------------------------------------------------------------------

    var OutputModel = {}; // Declare empty global object

        OutputModel.wsClusteringStats    = null;
        OutputModel.wsClusteringStatsUrl = 'ws://localhost:7080/v2/broker/?topics=clusteringStats';

        OutputModel.wsRawData       = null;
        OutputModel.wsRawDataUrl    = 'ws://localhost:7080/v2/broker/?topics=rawData';

        OutputModel.wsModelControl    = null;
        OutputModel.wsModelControlUrl = 'ws://localhost:7080/v2/broker/';
        OutputModel.wsMsn             = { topic : "analysisModel", message : "" };

        OutputModel.decayFactor     = 0.5;

        OutputModel.mode            = "manual";
        OutputModel.numClusters     = 3;

        OutputModel.Kmin            = 2;
        OutputModel.Kmax            = 10;

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
//          Initialization
// -------------------------------------------------------------------

    // Decay factor
        document.getElementById("decay").value = 0.5;
    // Mode - Manual / Automatic
        document.getElementById("myonoffswitch").checked = true;
    // Manual - K
        document.getElementById("numClusters").value = 3;
        document.getElementById("numClusters").disabled = false;
    // Automatic - Kmin / Kmax
        document.getElementById("kmin").value = 2;
        document.getElementById("kmax").value = 10;
        document.getElementById("kmin").disabled = true;
        document.getElementById("kmax").disabled = true;

// -------------------------------------------------------------------
//          WEBSOCKETS
// -------------------------------------------------------------------


    // Websockets - Open connection
    // *****************************
        document.getElementById('wbConnection').addEventListener('click', wbConnectionFunc);
        function wbConnectionFunc(){

            console.log('Trying to connect to socket');

            // Centroids socket
                OutputModel.wsClusteringStats = new WebSocket( OutputModel.wsClusteringStatsUrl );
                    OutputModel.wsClusteringStats.onopen    = wsClustStatsOpen;
                    OutputModel.wsClusteringStats.onerror   = wsErrorFunc;
                    OutputModel.wsClusteringStats.onmessage = wsClustStatsMsg;

            // RawData socket
                OutputModel.wsRawData = new WebSocket( OutputModel.wsRawDataUrl );
                    OutputModel.wsRawData.onopen    = wsRawDataOpen;
                    OutputModel.wsRawData.onerror   = wsErrorFunc;
                    OutputModel.wsRawData.onmessage = wsRawDataMsn;

            // Analysis model control socket
                OutputModel.wsModelControl = new WebSocket( OutputModel.wsModelControlUrl );
                    OutputModel.wsModelControl.onopen    = wsAnalysisControlOpen;
                    OutputModel.wsModelControl.onerror   = wsErrorFunc;
        }

    // Websockets - Close connection
    // *****************************
        document.getElementById('wbClose').addEventListener('click', wbCloseFunc);
        function wbCloseFunc(){

            console.log( 'Closing WebSockets' );

            OutputModel.wsClusteringStats.close();
            OutputModel.wsRawData.close();
        }

    // Websockets - Connection opened
    // *****************************
        var wsClustStatsOpen = function () {
            console.log('Clustering stats: Connection is open at ', new Date());
        };
        var wsRawDataOpen = function () {
            console.log('Raw data: Connection is open at ', new Date());
        };
        var wsAnalysisControlOpen = function () {
            console.log('Analysis model control: Connection is open at ', new Date());
        };

    // Websockets - Error
    // *****************************
        var wsErrorFunc = function (error) {
            console.log('WebSocket Error ', error);
        };

    // Websockets - Sending data
    // ***********************************************************
        document.getElementById('wbSend').addEventListener('click', wbSendFunc);

        function wbSendFunc(){

            console.log( 'Sending data:' );

            // Composing data to send
            var data;
            if( OutputModel.mode == "manual" ){
                data = { mode: "manual"                 ,
                         decay: OutputModel.decayFactor ,
                         k: OutputModel.numClusters
                       };
            }else{
                data = { mode: "automatic"              ,
                         decay: OutputModel.decayFactor ,
                         kmin: OutputModel.Kmin         ,
                         kmax: OutputModel.Kmax
                       };
            }

            // Data to Json string message
            OutputModel.wsMsn.message = JSON.stringify( data );
            var msn = JSON.stringify( OutputModel.wsMsn );

            console.log( msn);

            // Sending message through websocket
            OutputModel.wsModelControl.send( msn );

        }

    // Websockets - Received messages
    // *****************************

        // Clustering statistics
        // --------------------------
        var wsClustStatsMsg = function (e) {

            console.log( 'Clustering statistics msg: ', e.data, ' at ', new Date() );

            // Parsing message
            var msg = JSON.parse( JSON.parse(e.data).message );

            // Centroids
            OutputModel.centroids = msg.centroids;
            updateCentroids( msg.meanDistPerCluster );

            // Cost
            updateCostPlot( [msg.cost, msg.modelRealCost] );

            // Samples per cluster
            OutputModel.saHist = msg.nSaPerCluster;
            updateSaHist( msg.nSaPerCluster );

            // Repartition index
            updateSaClusterIndex( msg.nSaIndex );

            // Average distance to clusters centroids
            updateMeanDistPlot( msg.meanDistPerCluster );


        };

        // Raw data
        // --------------------------
            var counter = 0;
            var wsRawDataMsn = function (e) {

                var n = 50;

                OutputModel.rawData.unshift( JSON.parse( JSON.parse(e.data).message ) );
                if ( OutputModel.rawData.length > n )
                    OutputModel.rawData.length = n;

                counter++;
                if ( counter % n == 0 ) {
                    counter = 0;
                    updateRawData();
                }

            }


// -------------------------------------------------------------------
//          ANALYSIS MODEL INPUTS
// -------------------------------------------------------------------

    // Decay factor
        d3.select("#decay").on("input", function() {
            changeModelParameter( "decay",+this.value );
        });

    // Mode - Manual / Automatic
        d3.select("#myonoffswitch").on("change",function(){

            if( this.checked ){

                OutputModel.mode = "manual";

                d3.selectAll(".automatic").attr('disabled', 1 );
                d3.selectAll(".manual").attr('disabled', null );

            }else{
                OutputModel.mode = "automatic";

                d3.selectAll(".automatic").attr('disabled', null );
                d3.selectAll(".manual") .attr('disabled', 1 );
            }
        })

    // Manual - K
        d3.select("#numClusters").on("input", function() {
            changeModelParameter( "numClusters",+this.value );
        });

    // Automatic - Kmin / Kmax
        d3.select("#kmin").on("input", function() {
            changeModelParameter( "Kmin",+this.value );
        });

        d3.select("#kmax").on("input", function() {
            changeModelParameter( "Kmax",+this.value );
        });

    // Change parameter function
    function changeModelParameter( param, value ){

        switch( param ) {

            case "decay":
                OutputModel.decayFactor = value;
                break;

            case "numClusters":
                OutputModel.numClusters = value;
                break;

            case "Kmin":
                OutputModel.Kmin = value;
                break;

            case "Kmax":
                OutputModel.Kmax = value;
                break;

        }
    }