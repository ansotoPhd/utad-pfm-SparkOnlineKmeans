

import java.util.Properties

import org.json4s.DefaultFormats
import org.json4s.native.Serialization.write

import org.apache.kafka.clients.producer.{ProducerRecord, ProducerConfig, KafkaProducer}
import org.apache.log4j.{Level, Logger}
import org.apache.spark.SparkConf
import org.apache.spark.mllib.clustering.{StreamingKMeansModel, StreamingKMeans}
import org.apache.spark.mllib.linalg.{Vector, Vectors}
import org.apache.spark.streaming.dstream.DStream
import org.apache.spark.streaming.{Seconds, StreamingContext}
import org.elasticsearch.spark._

import scala.collection.mutable.HashMap


/*
    Author: Antonio Soriano
 */

case class ClusteringStats( nSa: Int,
                            nSaPerCluster:Array[Int],
                            nSaIndex:Double,
                            meanDistPerCluster:Array[Double]
                          )

object OnlineKmeans extends App{

  // Kafka topics
    val CENTROIDS_TOPIC   = "centroids"
    val RAWDATA_TOPIC     = "rawData"
    val COST_TOPIC        = "cost"
    val SA_CLUSTER_TOPIC  = "samplesPerCluster"

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
    val props = new Properties()
        props.put( ProducerConfig.BOOTSTRAP_SERVERS_CONFIG,
                   "localhost:9092" )
        props.put( ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,
                   "org.apache.kafka.common.serialization.StringSerializer")
        props.put( ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,
                   "org.apache.kafka.common.serialization.StringSerializer")

  // Spark streaming context
    val ssc  = new StreamingContext( conf, Seconds(1) )

  // Kakfa - Master producer
    val masterProducer = new KafkaProducer[String, String](props)

  // Kmeans model configuration
    val numDimensions = 2
    val numClusters   = 3
    val streamingModel = new StreamingKMeans()
          .setK( numClusters )
          .setDecayFactor(0.5)
          .setRandomCenters( numDimensions, 0.0 )

  // Streaming data through a socket
    val inputData = ssc.socketTextStream( "127.0.0.1", 9999 )

  // Pre-processing input data
    val trainingData = inputData
                          .map( u => u.split(" -> ") )
                          .map( u => u(1).mkString("[","","]") )
                          .map( Vectors.parse )

  // Ground truth cost
    val realCost      = inputData.map( u => u.split(" -> ")(0).toDouble )
    val miniBatchCost = realCost.reduce( _ + _ )

    var modelRealCost = 0.0;
    miniBatchCost.foreachRDD( rdd => {
      val col: Array[Double] = rdd.collect();
      modelRealCost = if( col.size == 1 ) col(0) else 0.0;
      println( "Real cost: " + modelRealCost ) }
    )

  // For each RDD in the DStream --> Re-train model
    streamingModel.trainOn( trainingData )

  // Latest model
    val currentModel: StreamingKMeansModel = streamingModel.latestModel();

  // For each RDD
    var cost = 0.0;
    trainingData.foreachRDD(
      rdd => {
        println( "new data Rdd" )

        // Latest centroids
          val centroids       = currentModel.clusterCenters;
          val centroidsString = centroids.map( _.toString ).mkString("[",",","]")

        // Enviamos centroides a topic de kafka
          val centroidMsg  = new ProducerRecord[String, String]( CENTROIDS_TOPIC, null, centroidsString )
          println( "Kafka centroids: " + centroidMsg )
          masterProducer.send( centroidMsg )

        // Cost
          cost = currentModel.computeCost( rdd );
          val costMsg = new ProducerRecord[String, String]( COST_TOPIC, null, "["+cost+","+modelRealCost+"]" )
          println( "Kafka cost: " + costMsg )
          masterProducer.send( costMsg )
          //masterProducer.close()

        // Distribución en número de datos
/*          val nSamples = rdd.count()
          if( nSamples > 0 ) {

            // Histograma
            val hist = currentModel.predict(rdd).histogram( currentModel.k )

            // Cálculo del índice de Shannon
            val entropy    = -1*hist._2.map( ni => ni.toDouble/ nSamples.toDouble ).map( pi => pi*Math.log(pi) ).sum;
            println( "entropy = " + entropy )
            val correction = ( currentModel.k - 1).toDouble/(2*nSamples);
            println( "correction = " + correction )
            val SE: Double = entropy + correction;
            println( "SE = " + SE )
            val SY: Double = 1 - SE/Math.log(currentModel.k);
            println( "SY = " + SY )

            val histMsgJson = "{   \"nSa\": \"" + nSamples + "\", " +
                                  "\"hist\": "  + hist._2.mkString("[",",","]") + ", " +
                                  "\"index\": \""  + SY + "\"" +
                              "}"
            val histMsg = new ProducerRecord[String, String](SA_CLUSTER_TOPIC, null, histMsgJson)
            println("Kafka hist: " + histMsg)
            masterProducer.send( histMsg )

          }*/

          // Clusters stats
          // -----------------------
           val meanDist: Array[(Int, (Int, Double))] =
                rdd.map(v  => ( currentModel.predict(v), v ) )
                   .map( cv => ( cv._1, cv._2, currentModel.clusterCenters( cv._1) ) )
                   .map( cvv => ( cvv._1, Vectors.sqdist( cvv._2, cvv._3) ) )
                   .aggregateByKey( (0.0,0) )(                                                // ZeroValue
                                    (acc, value) => ( acc._1 + value, acc._2 + 1 ),           // SeqOp
                                    (acc1, acc2) => ( acc1._1 + acc2._1,  acc1._2 + acc2._2)  // CombOp
                                  )
                   .mapValues { case (sumedValue,count) => (count, sumedValue/count ) }.collect()

           meanDist.foreach( c => print( "Cluster " + c._1 + " nSa: " + c._2._1 + " meanD: " + c._2._2 + "\n" ))

            val N      = meanDist.map( t => t._2._1 ).sum
            val hist   = meanDist.map( t => t._2._1 ).array
            val cMeanD = meanDist.map( t => t._2._2 ).array

            // Cálculo del índice de Shannon
            val entropy    = -1*hist.map( ni => ni.toDouble/ N.toDouble ).map( pi => pi*Math.log(pi) ).sum;
            println( "entropy = " + entropy )
            val correction = ( currentModel.k - 1).toDouble/(2*N);
            println( "correction = " + correction )
            val SE: Double = entropy + correction;
            println( "SE = " + SE )
            val SY: Double = 1 - SE/Math.log(currentModel.k);
            println( "SY = " + SY )

        val histMsgJson = write( ClusteringStats( N, hist, SY, cMeanD ) )
          println( histMsgJson )

        val histMsg = new ProducerRecord[String, String]( SA_CLUSTER_TOPIC, null, histMsgJson )
        println("Kafka hist: " + histMsg)
        masterProducer.send( histMsg )

        // Sending input data to kafka
          rdd.foreachPartition(
            partitionOfRecords => {

              val workerProducer = new KafkaProducer[String, String](props)

              partitionOfRecords.foreach(
                x => {
                  val rawDataMsg = new ProducerRecord[String, String]( RAWDATA_TOPIC , null, x.toString )
                  //println( message )
                  workerProducer.send( rawDataMsg )
                }
              )
              workerProducer.close()
            }
          )
      }
    )

// For each RDD in the DStream --> Predictions with the actualized model
//    val predictions: DStream[Int] = streamingModel.predictOn( trainingData )


//    val closedCentroid: DStream[Vector] = predictions.map( centroids(_) )
//    closedCentroid.print()
//
//    val indexCentroid = closedCentroid.transform( rdd => rdd.zipWithIndex().map( _.swap ) )
//    val indexTraining = trainingData.transform( rdd => rdd.zipWithIndex().map( _.swap ) )
//
//    var error = indexCentroid.join( indexTraining ).map( _._2 ).map( v => Math.pow( Vectors.sqdist(v._1, v._2), 2 ) )
//    error.print()

  // val cost: Unit = trainingData.foreachRDD( rdd => model.latestModel().computeCost( rdd ) )

//      predictions
//        .foreachRDD(
//          rdd => {
//
//            // Centroides a string
//              val centroidsString = centroids.map( _.toString ).mkString("[",",","]")
//
//            // Enviamos centroides a topic de kafka
//              val producer = new KafkaProducer[String, String](props)
//              val message  = new ProducerRecord[String, String]( CENTROIDS_TOPIC, null, centroidsString )
//                println( message )
//              producer.send( message )
//              producer.close()
//          }
//        )

  /*  // Almacenado en ElasticSearch
      td.foreachRDD(
      rdd => {  println( "Centroids: " )
              case class Centroid( name: String, data: Array[Double] )
              model.latestModel().clusterCenters.foreach( u => println( u.toString ) )
              rdd.map( u => new Centroid( "centroid", u.toArray)).saveToEs("spark/docs")

           }
    )*/

  ssc.start()
  ssc.awaitTermination()

  masterProducer.close()
}
