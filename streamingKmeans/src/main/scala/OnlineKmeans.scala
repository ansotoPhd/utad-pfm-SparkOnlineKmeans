
import org.apache.log4j.{Level, Logger}
import org.apache.spark.SparkConf
import org.apache.spark.mllib.clustering.StreamingKMeans
import org.apache.spark.mllib.linalg.Vectors
import org.apache.spark.streaming.{Seconds, StreamingContext}
import org.elasticsearch.spark._

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
      .setDecayFactor(1.0)
      .setRandomCenters(numDimensions, 0.0)

  // Streaming data through a socket
    val inputData = ssc.socketTextStream( "127.0.0.1", 9999 )

  // Pre-processing input data
    val splitted = inputData.map( u => u.split(" -> ") )
    val trainingData = splitted.map( u => u(1).mkString("[","","]") )
    val td = trainingData.map( Vectors.parse )

  // Re-training model
    model.trainOn( td )

  // Predictions
    val predictions = model.predictOn( td )


    predictions.foreachRDD { rdd =>

      val modelString = model.latestModel().clusterCenters
        .map(c => c.toString.slice(1, c.toString.length-1)).mkString("\n")

      val predictString = rdd.map(p => p.toString).collect().mkString("\n")

    }

  case class Centroid( name: String, data: Array[Double])

  td.foreachRDD(
    u => {  println( "Centroids: " )
            model.latestModel().clusterCenters.foreach( u => println( u.toString ) )
            u.map( u => new Centroid( "centroid", u.toArray)).saveToEs("spark/docs")

         }
  )

  ssc.start()
  ssc.awaitTermination()
}
