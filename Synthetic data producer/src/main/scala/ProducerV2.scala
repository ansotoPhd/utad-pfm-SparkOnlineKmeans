import java.io.PrintWriter
import java.net.ServerSocket

import breeze.linalg.DenseVector
import breeze.stats.distributions.Multinomial
import org.apache.commons.math3.distribution.MultivariateNormalDistribution

case class ClusterModel( val ts:Int ) {

  var categoricalDist: Multinomial[DenseVector[Double], Int] = null
  var mvGaussianArray: Array[MultivariateNormalDistribution] = null

  // ( cluster label, sample )
  def drawSample(): (Int, Array[Double]) = {

    if( categoricalDist != null && mvGaussianArray != null ) {
      // Obtaining cluster number which will generate the new sample
        val clusterNum = this.categoricalDist.draw()
      // New sample
        ( clusterNum, this.mvGaussianArray(clusterNum).sample() )

    }else
      (0, Array(0.0,0.0) )
  }

  def updateCategoricalDist(dist: Array[Double]) {
    this.categoricalDist = Multinomial(DenseVector(dist))
  }

  def updateMvGaussians(dist: Array[MultivariateNormalDistribution]): Unit = {
    this.mvGaussianArray = dist

  }
}

object ProducerV2 extends App{

  // Cluster model
    val Ts = 100;

    val model = new ClusterModel( Ts );

  // Kafka consumer --> Updates model when a msn is received
    val zooKeeper: String = "localhost:2181"
    val groupId: String = "default"
    val topic: String = "model"
    val consumer: CustomKafkaConsumer = new CustomKafkaConsumer(zooKeeper, groupId, topic)

    consumer.run( model )


  // create a network producer
    val listener = new ServerSocket( 9999 )
    println( "Listening on port: 9999" )

  while (true) {
    val socket = listener.accept()

    new Thread() {
      override def run = {
        println( "Got client connected from: " + socket.getInetAddress )

        var t = 0
        var sampleCounter = 0

        val out = new PrintWriter( socket.getOutputStream(), true )

        while (true) {

          // New sample
          val sample = model.drawSample()

          if( sampleCounter % 100 == 0)
            println( "Sample: " + sampleCounter + " Cluster: " + sample._1 + " : " + sample._2.mkString(" ") )

          out.write( sample._1 + " -> " + sample._2.mkString(",") )
          out.write("\n")
          out.flush()

          sampleCounter += 1
          t += model.ts

          Thread.sleep( model.ts )

        }

        socket.close()
      }

    }.start()

  }

}
