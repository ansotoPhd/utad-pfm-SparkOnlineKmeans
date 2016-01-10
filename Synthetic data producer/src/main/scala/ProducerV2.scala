import java.io.PrintWriter
import java.net.ServerSocket

import breeze.linalg.DenseVector
import breeze.stats.distributions.Multinomial
import org.apache.commons.math3.distribution.MultivariateNormalDistribution
import org.apache.spark.mllib.clustering.KMeansModel
import org.apache.spark.mllib.linalg.{Vector, Vectors}

/** Synthetic data generator model */
case class ClusterModel( val ts:Int ) {

  var categoricalDist: Multinomial[DenseVector[Double], Int] = null
  var mvGaussianArray: Array[MultivariateNormalDistribution] = null
  var kmeansModel:KMeansModel = null

  // ( centroid, cost, sample )
  def drawSample(): ( Array[Double], Double, Array[Double] ) = {

    if( categoricalDist != null && mvGaussianArray != null && kmeansModel != null ) {

      // Obtaining cluster number which will generate the new sample
        val clusterNum = this.categoricalDist.draw()

      // New data-point
        val data = this.mvGaussianArray(clusterNum).sample()

      // Cost associated with data-point
        val dataVector = Vectors.dense(data)
        val closestCentroid: Vector = kmeansModel.clusterCenters( kmeansModel.predict( dataVector ) )
        val cost = Vectors.sqdist( dataVector, closestCentroid )
        ( closestCentroid.toArray, cost, data )

    }else
      ( Array(0.0), 0, Array(0.0,0.0) )
  }

  def updateCategoricalDist( dist: Array[Double] ) {
    this.categoricalDist = Multinomial(DenseVector(dist))
  }

  def updateMvGaussians( dist: Array[MultivariateNormalDistribution] ): Unit = {
    this.mvGaussianArray = dist

  }

  def createKmeansModel(): Unit ={
    this.kmeansModel = new KMeansModel( this.mvGaussianArray.map( f => Vectors.dense( f.getMeans) ) )
  }

}

object ProducerV2 extends App{

  // Cluster model
    val Ts = 1;   // Time sampling (ms)
    val model = new ClusterModel( Ts );

  // Kafka consumer --> Updates model when a msn is received
    val zooKeeper:String = "localhost:2181"
    val groupId:String   = "default"
    val topic:String     = "inputModel"
    val consumer: CustomKafkaConsumer = new CustomKafkaConsumer( zooKeeper, groupId, topic )

    consumer.run( model )

  // create a network producer
    val listener = new ServerSocket( 9999 )
    println( "Listening on port: 9999" )

  while( true ) {
    val socket = listener.accept()

    new Thread() {

      override def run = {
        println( "Got client connected from: " + socket.getInetAddress )

        var t = 0
        var sampleCounter = 0

        val out = new PrintWriter( socket.getOutputStream(), true )

        while( !socket.isOutputShutdown ) {

          // New sample
          try {
            // ...
            val sample = model.drawSample()

            if( sampleCounter % 100 == 0)
              println(
                "Sample: " + sampleCounter +
                " Centroid: " + sample._1.mkString( " ") +
                " Cost: " +     sample._2 +
                " Data: " +     sample._3.mkString(" ") )

            out.write( sample._2 + " -> " + sample._3.mkString(",") )
            out.write("\n")
            out.flush()

          } catch {
            case e: Exception => {}
          }

          sampleCounter += 1
          t += model.ts

          Thread.sleep( model.ts )

        }

        socket.close()
      }

    }.start()

  }

}
