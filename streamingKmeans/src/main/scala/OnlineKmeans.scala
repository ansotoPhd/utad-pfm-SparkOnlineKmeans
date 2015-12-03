

import java.util.Properties

import org.apache.kafka.clients.producer.{ProducerRecord, ProducerConfig, KafkaProducer}
import org.apache.log4j.{Level, Logger}
import org.apache.spark.SparkConf
import org.apache.spark.mllib.clustering.StreamingKMeans
import org.apache.spark.mllib.linalg.Vectors
import org.apache.spark.streaming.{Seconds, StreamingContext}
import org.elasticsearch.spark._

import scala.collection.mutable.HashMap


/*
    Author: Antonio Soriano
 */

object OnlineKmeans extends App{

  // Disabling loggers
    Logger.getLogger("org").setLevel(Level.OFF)
    Logger.getLogger("akka").setLevel(Level.OFF)

  // Spark conf
    val conf = new SparkConf().setMaster("local[2]").setAppName("StreamingKmeans")
          conf.set("es.nodes","127.0.0.1")
          conf.set("es.port","9200")
          conf.set("es.index.auto.create", "true")

  // Spark streaming context
    val ssc  = new StreamingContext( conf, Seconds(1) )

  // Kmeans model configuration
    val numDimensions = 2
    val numClusters   = 3
    val model = new StreamingKMeans()
      .setK(numClusters)
      .setDecayFactor(0.1)
      .setRandomCenters(numDimensions, 0.0)

  // Streaming data through a socket
    val inputData = ssc.socketTextStream( "127.0.0.1", 9999 )

  // Pre-processing input data
    val splitted = inputData.map( u => u.split(" -> ") )
    val trainingData = splitted.map( u => u(1).mkString("[","","]") )
    val td = trainingData.map( Vectors.parse )

  // For each RDD in the DStream --> Re-train model
    model.trainOn( td )

  // For each RDD in the DStream --> Predictions with the actualized model
    val predictions = model.predictOn( td )


    predictions.foreachRDD { rdd =>

      val modelString = model.latestModel().clusterCenters
        .map(c => c.toString.slice(1, c.toString.length-1)).mkString("\n")

      val predictString = rdd.map(p => p.toString).collect().mkString("\n")

    }

  case class Centroid( name: String, data: Array[Double])

/*  td.foreachRDD(
    rdd => {  println( "Centroids: " )

            model.latestModel().clusterCenters.foreach( u => println( u.toString ) )
            rdd.map( u => new Centroid( "centroid", u.toArray)).saveToEs("spark/docs")

         }
  )*/

  val props = new Properties()

  props.put( ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092" )
  props.put( ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,
    "org.apache.kafka.common.serialization.StringSerializer")
  props.put( ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,
    "org.apache.kafka.common.serialization.StringSerializer")

  td.foreachRDD(
    rdd => {
      println("newRdd")
      val centroids = model.latestModel().clusterCenters.map( _.toString ).mkString("[",",","]")
      val producer = new KafkaProducer[String, String](props)
      val message = new ProducerRecord[String, String]("centroids3", null, centroids )
      println( message )
      producer.send( message )

      rdd.foreachPartition(
        partitionOfRecords => {

          val producer = new KafkaProducer[String, String](props)

          partitionOfRecords.foreach(
            x => {
              val message = new ProducerRecord[String, String]("rawData", null, x.toString)
              println( message )
              producer.send(message)
            }

          )
        }
      )
    }
  )


  ssc.start()
  ssc.awaitTermination()
}
