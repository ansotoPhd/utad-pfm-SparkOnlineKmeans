

import java.util.Properties

import org.apache.spark.rdd.RDD
import org.json4s.DefaultFormats
import org.json4s.native.Serialization._

import org.apache.kafka.clients.producer.{ProducerRecord, ProducerConfig, KafkaProducer}
import org.apache.log4j.{Level, Logger}
import org.apache.spark.SparkConf
import org.apache.spark.mllib.clustering.{StreamingKMeans, StreamingKMeansModel}
import org.apache.spark.mllib.linalg.{Vector, Vectors}
import org.apache.spark.streaming.{Seconds, StreamingContext}


/*
    Author: Antonio Soriano
 */

case class ClusteringStatsV2(
  k:   Int,
  nSa: Int,
  cost: Double,
  modelRealCost: Double,
  centroids: Array[ Array[Double] ],
  nSaPerCluster:Array[Int],
  nSaIndex:Double,
  meanDistPerCluster:Array[Double]
)

class ChangeModelMsg( var msg: String ){

  def set( newMsg: String) {
    this.synchronized {
      msg = newMsg
    }
  }
  def get() = synchronized {
      val out = msg
      msg = ""
      out
  }
}

case class KmeansModel(
  var mode:String,
  var decay:Double,
  var k:Option[Int],
  var kmin:Option[Int],
  var kmax:Option[Int]
)

object OnlineKmeansVariableK extends App{

  // Kafka topics
    val CLUST_STATS_TOPIC = "clusteringStats"
    val RAWDATA_TOPIC     = "rawData"

  // Disabling loggers
    Logger.getLogger("org").setLevel(Level.OFF)
    Logger.getLogger("akka").setLevel(Level.OFF)

  // Reading model definition from Json; deserializating it.
    implicit val formats = DefaultFormats

  // Spark conf
    val conf = new SparkConf().setMaster("local[2]").setAppName("StreamingKmeans")
    conf.set("es.nodes","127.0.0.1")
    conf.set("es.port","9200")
    conf.set("es.index.auto.create", "true")

  // Kafka producers conf
    val props: Properties = new Properties()
        props.put( ProducerConfig.BOOTSTRAP_SERVERS_CONFIG,
                   "localhost:9092" )
        props.put( ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,
                   "org.apache.kafka.common.serialization.StringSerializer")
        props.put( ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,
                   "org.apache.kafka.common.serialization.StringSerializer")

  // Spark streaming context
    val ssc  = new StreamingContext( conf, Seconds(1) )

  // Kafka consumer for k-means model configuration
    val modelConfMsg:ChangeModelMsg = new ChangeModelMsg("")
    val zooKeeper:String = "localhost:2181"
    val groupId:String   = "default"
    val topic:String     = "analysisModel"
    val kafkaConsumer: CustomKafkaConsumer = new CustomKafkaConsumer( zooKeeper, groupId, topic )
    kafkaConsumer.run( modelConfMsg )

  // Kakfa - Master producer
    val masterProducer = new KafkaProducer[String, String](props)

  // Kafka - Workers producers
    val kafkaSink = ssc.sparkContext.broadcast( KafkaSink( props ) )

  // Online Kmeans models configuration
  // ---------------------------------------------------------------------
    val numDimensions   = 2
    val numModels       = 1
    val initK           = 3
    var streamingModels = new Array[StreamingKMeans]( numModels )
    for( i <- 0 to numModels-1 ){
      streamingModels(i) =
        new StreamingKMeans()
          .setK( i+initK )
          .setDecayFactor(0.5)
          .setRandomCenters( numDimensions, 0.0 )
    }

  //  Streaming data through a socket
  // ----------------------------------------------------------------------
    val inputData = ssc.socketTextStream( "127.0.0.1", 9999 )

  // Pre-processing input data
  // ----------------------------------------------------------------------
    val trainingData =
          inputData
            .map( u => u.split(" -> ") )
            .map( u => u(1).mkString("[","","]") )
            .map( Vectors.parse )

  //  Ground truth cost
  // ----------------------------------------------------------------------
    val realCost      = inputData.map( u => u.split(" -> ")(0).toDouble )
    val miniBatchCost = realCost.reduce( _ + _ )

    var modelRealCost = 0.0;
    miniBatchCost.foreachRDD( rdd => {
      val col: Array[Double] = rdd.collect();
      modelRealCost = if( col.size == 1 ) col(0) else 0.0;
      println( "Real cost: " + modelRealCost ) }
    )

  //  Training models
  // ----------------------------------------------------------------------
    //for( model <- streamingModels )
      //model.trainOn( trainingData )


    def computeClusteringStats( rdd:RDD[Vector], trainedModel: StreamingKMeansModel ): ClusteringStatsV2 ={

      // Number of clusters
        val k: Int = trainedModel.k

      // Centroids
        val vCentroids: Array[Vector]       = trainedModel.clusterCenters
        val centroids: Array[Array[Double]] = vCentroids.map( _.toArray )

      // Cost
        val cost = trainedModel.computeCost( rdd );

      // Samples assigned to each cluster statistics
        val clusterSamplesStats: Array[(Int, (Int, Double))] =
              rdd
                // ( Assigned cluster, sample )
                .map( v  => ( trainedModel.predict(v), v ) )
                // ( Assigned cluster, sample, centroid of cluster )
                .map( cv => ( cv._1, cv._2, vCentroids( cv._1) ) )
                // ( Assigned cluster, distance of sample to cluster centroid )
                .map( cvv => ( cvv._1, Math.sqrt( Vectors.sqdist( cvv._2, cvv._3) ) ) )
                // Calculating average of distances for each cluster
                .aggregateByKey( (0.0,0) )(                                  // ZeroValue
                   (acc, value) => ( acc._1 + value, acc._2 + 1 ),           // SeqOp
                   (acc1, acc2) => ( acc1._1 + acc2._1,  acc1._2 + acc2._2)  // CombOp
                )
                .mapValues { case (sum,count) => (count, sum/count ) }.collect()

        val nSaTotal: Int                       = clusterSamplesStats.map(t => t._2._1 ).sum
        val nSaPerCluster: Array[Int]           = clusterSamplesStats.map(t => t._2._1 ).array
        val meanDistToCentroids: Array[Double]  = clusterSamplesStats.map(t => t._2._2 ).array

      // Cálculo del índice de Shannon
        val entropy    = -1*nSaPerCluster.map( ni => ni.toDouble/ nSaTotal.toDouble ).map( pi => pi*Math.log(pi) ).sum;
        val correction = ( trainedModel.k - 1).toDouble/(2*nSaTotal);
        val SE: Double = entropy + correction;
        var SY: Double = 1 - SE/Math.log(trainedModel.k);
        SY = if( SY < 0 ) 0.0 else SY

      // Distances beetween centroids
        if( k == vCentroids.length && k == meanDistToCentroids.length ) {
          val centroidsDist =
            for (i <- 0 to k - 2; j <- i + 1 to k - 1) yield {
              val dij = Math.sqrt(Vectors.sqdist(vCentroids(i), vCentroids(j)))
              // ((i, j), (dij, (meanDistToCentroids(i), meanDistToCentroids(j))))
              Array( i, j, dij )
            }

          println( write(centroidsDist ) )
        }



      new ClusteringStatsV2( k,nSaTotal,cost,modelRealCost,centroids, nSaPerCluster, SY, meanDistToCentroids )

    }

  // Mini-Batch processing --> Operation on each RDD
  // ---------------------------------------------------------------------------------------------

    var cost = 0.0;
    trainingData.foreachRDD(
      rdd => {
        println( "new data Rdd" )

        // Training models
        // **************************************
          streamingModels.foreach( m => m.latestModel().update( rdd, m.decayFactor, m.timeUnit) )

        // Calculating clustering models stats
        // *************************************
          val evaluatedModels: Array[ClusteringStatsV2] =
            for( model <- streamingModels ) yield computeClusteringStats( rdd, model.latestModel() )

        //  Model selection
        // *************************************
          val costs:   Array[Double] = evaluatedModels.map( m => m.cost     )
          val syIndex: Array[Double] = evaluatedModels.map( m => m.nSaIndex )

          println( "Costs " + costs.mkString(",") )
          println( "Index " + syIndex.mkString(",") )

          val relCost: Array[Double] = costs.map( x => Math.abs( ( x-costs.min )/ ( costs.max - costs.min) ) )
          println( "rel Costs " + relCost.mkString(",") )

          val alpha = 0.2
          val values: Array[Double] = ( for(i <- 0 to costs.length-2 ) yield  alpha*relCost(i) + (1 -alpha)*syIndex(i)/syIndex.max ).toArray

          println( "Values " + values.mkString(",") )
          val index = values.foldLeft(0,Double.MaxValue,0) {
              case ((maxIndex, maxValue, currentIndex), currentValue) =>
                if(currentValue < maxValue) (currentIndex,currentValue,currentIndex+1)
                else (maxIndex,maxValue,currentIndex+1)
            } ._1

          println( "Optimal K: " + (index + 2) )

        // Sending data to kafka
        // *************************************

          // Clustering stats
            val msgJson = write( evaluatedModels(index) )
            println( msgJson )

            val histMsg = new ProducerRecord[String, String]( CLUST_STATS_TOPIC, msgJson )
            println("Kafka hist: " + histMsg)
            masterProducer.send( histMsg )

          // Sending input data to kafka

            rdd.sample( false,0.2,0 ).foreach { x =>
              kafkaSink.value.send( RAWDATA_TOPIC, x.toString )
            }

        //  Checking if analysis model has changed
        // *****************************************
        val analysisModelChange: String = modelConfMsg.get()
        if( analysisModelChange != "" ) {

          System.out.println( "Model change: " + analysisModelChange )
          System.out.println( "--------------------------------------------- ")

          val json = org.json4s.native.JsonMethods.parse(analysisModelChange)
          val model = json.extract[KmeansModel]

          if( model.mode == "manual" ){

            streamingModels = Array(
                                new StreamingKMeans()
                                      .setK( model.k.get )
                                      .setDecayFactor( model.decay )
                                      .setRandomCenters( numDimensions, 0.0 )
                              )
          }else{

            val numModels   = model.kmax.get - model.kmin.get + 1
            val initK       = model.kmin.get
            streamingModels = new Array[StreamingKMeans]( numModels )
            for( i <- 0 to numModels-1 ){
              streamingModels(i) =
                new StreamingKMeans()
                  .setK( i+initK )
                  .setDecayFactor( model.decay )
                  .setRandomCenters( numDimensions, 0.0 )

            }
          }
        }
      }
    )

  ssc.start()
  ssc.awaitTermination()

  masterProducer.close()
}
