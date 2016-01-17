

import java.util.Properties

import org.apache.spark.streaming.dstream.DStream
import org.json4s.DefaultFormats
import org.json4s.native.Serialization._

import org.apache.kafka.clients.producer.{ProducerRecord, ProducerConfig, KafkaProducer}
import org.apache.log4j.{Level, Logger}
import org.apache.spark.SparkConf
import org.apache.spark.mllib.clustering.{StreamingKMeans, StreamingKMeansModel}
import org.apache.spark.mllib.linalg.{Vector, Vectors}
import org.apache.spark.streaming.{Seconds, StreamingContext}

object OnlineKmeansVariableK extends App{

  // Disabling loggers
    Logger.getLogger("org").setLevel(Level.OFF)
    Logger.getLogger("akka").setLevel(Level.OFF)

  // Reading model definition from Json; deserializating it.
    implicit val formats = DefaultFormats

  // ---------------------------------------------------------------------
  //    Spark connection
  // ---------------------------------------------------------------------

    // Spark conf
      val conf = new SparkConf().setMaster("local[2]").setAppName("StreamingKmeans")

    // Spark streaming context
      val ssc  = new StreamingContext( conf, Seconds(1) )

  // ---------------------------------------------------------------------
  //    Kafka connection
  // ---------------------------------------------------------------------

    // Kafka - Used topics
      val CLUST_STATS_TOPIC = "clusteringStats"
      val RAWDATA_TOPIC     = "rawData"
      val MODEL_TOPIC       = "analysisModel"

    //  Kafka consumer  (k-means model configuration)
    // ****************
      val modelConfMsg:ChangeModelMsg = new ChangeModelMsg("")
      val zooKeeper:String = "localhost:2181"
      val groupId:String   = "default"

      val kafkaConsumer: CustomKafkaConsumer = new CustomKafkaConsumer( zooKeeper, groupId, MODEL_TOPIC )

      kafkaConsumer.run( modelConfMsg )

    //  Kafka producers
    // *****************
      val kafkaProducersProps: Properties = new Properties()
            kafkaProducersProps.put(  ProducerConfig.BOOTSTRAP_SERVERS_CONFIG,
                                      "localhost:9092" )
            kafkaProducersProps.put(  ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,
                                      "org.apache.kafka.common.serialization.StringSerializer" )
            kafkaProducersProps.put(  ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,
                                      "org.apache.kafka.common.serialization.StringSerializer" )

      // Kakfa - Master producer - Sends clustering stats
        val masterProducer = new KafkaProducer[String, String]( kafkaProducersProps )

      // Kafka - Workers producers - Sends input data
        val kafkaSink = ssc.sparkContext.broadcast( KafkaSink( kafkaProducersProps ) )

  // ---------------------------------------------------------------------
  // Online Kmeans models configuration
  // ---------------------------------------------------------------------

    val numDimensions   = 2
    var numModels       = 1
    var initK           = 3
    var decay           = 0.5
    var streamingModels = new Array[StreamingKMeans]( numModels )
    for( i <- 0 to numModels-1 ){
      streamingModels(i) =
        new StreamingKMeans()
          .setK( i+initK )
          .setDecayFactor( decay )
          .setRandomCenters( numDimensions, 0.0 )
    }

  // ---------------------------------------------------------------------
  //  Receiving Streaming data through a socket
  // ----------------------------------------------------------------------

    val inputData = ssc.socketTextStream( "127.0.0.1", 9999 )

  // ---------------------------------------------------------------------
  //  Processing pipeline.  Input data: DStream[ "real distortion -> x,y " ]
  // ----------------------------------------------------------------------

  // Pre-processing input data
  // ************************************************
    val trainingData: DStream[Vector] =
          inputData
            .map( u => u.split(" -> ") )
            .map( u => u(1).mkString("[","","]") )
            .map( Vectors.parse )

  //  Obtaining 'real' cost (distortion) in each RDD
  // *************************************************
    val realCost: DStream[Double]      = inputData.map(u => u.split(" -> ")(0).toDouble )
    val miniBatchCost: DStream[Double] = realCost.reduce( _ + _ )

    var modelRealCost = 0.0;
    miniBatchCost.foreachRDD( rdd => {
        val col: Array[Double] = rdd.collect();
        modelRealCost = if( col.size == 1 ) col(0) else 0.0;
        println( "\tReal cost: " + modelRealCost )
      }
    )

  // Mini-Batch processing --> Operation on each RDD
  // *************************************************

    var cost = 0.0;
    trainingData.foreachRDD(
      rdd => { println( "\nNew Rdd" )

        // Training models
        // **************************************
          streamingModels.foreach( m => m.latestModel().update( rdd, m.decayFactor, m.timeUnit) )

        // Calculating clustering stats
        // *************************************
          val evaluatedModels: Array[(StreamingKMeansModel, ClusteringStats)] =
            for( model <- streamingModels )
            yield (model.latestModel(), ClusteringStats( rdd, modelRealCost, model.latestModel() ) )

        //  Model selection
        // *************************************
          val selectedModel = if( streamingModels.length > 1 ) ModelSelection.selectModel(evaluatedModels)
                              else 0

        // Sending data to kafka
        // *************************************

          // Clustering stats
            val msgJson = write( evaluatedModels( selectedModel )._2 )
            val histMsg = new ProducerRecord[String, String]( CLUST_STATS_TOPIC, msgJson )
            masterProducer.send( histMsg )

            println("\tNum. centroids: " +  evaluatedModels( selectedModel )._2.k )
            println("\tMini-Batch cost: " +  evaluatedModels( selectedModel )._2.cost )

          // Sending input data to kafka
            rdd.sample( false,0.2,0 ).foreach { x =>
              kafkaSink.value.send( RAWDATA_TOPIC, x.toString )
            }

        //  Checking if analysis model has changed
        // *****************************************
          val analysisModelChange: String = modelConfMsg.get()
          if( analysisModelChange != "" ) {

          println( "\n==> Model has changed: " + analysisModelChange )
          println( "--------------------------------------------------------\n" )

          val json  = org.json4s.native.JsonMethods.parse( analysisModelChange )
          val model = json.extract[KmeansModel]

          if( model.mode == "manual" ){
            val randomCenters: Array[Vector] = rdd.takeSample(false,model.k.get)
            streamingModels = Array( new StreamingKMeans().setK( model.k.get )
                                      .setDecayFactor( model.decay )
                                      .setInitialCenters( randomCenters, Array.fill(model.k.get){0.0} ) )
          }else{

            numModels   = model.kmax.get - model.kmin.get + 1
            initK       = model.kmin.get
            decay       = model.decay

            streamingModels = new Array[StreamingKMeans]( numModels )
            for( i <- 0 to numModels-1 ){
              val randomCenters: Array[Vector] = rdd.takeSample(false,i+initK)
              streamingModels(i) = new StreamingKMeans().setK( i+initK )
                                        .setDecayFactor( decay )
                                        .setInitialCenters( randomCenters, Array.fill(i+initK){0.0} )
            }
          }
      }
    }
  )

  // ---------------------------------------------------------------------
  //  Initialize streaming processing
  // ----------------------------------------------------------------------

    ssc.start()
    ssc.awaitTermination()

    masterProducer.close()

}
