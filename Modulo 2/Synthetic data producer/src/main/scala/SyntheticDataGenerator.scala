import java.io.PrintWriter
import java.net.ServerSocket

import breeze.linalg.DenseVector
import breeze.stats.distributions.Multinomial
import org.apache.commons.math3.distribution.MultivariateNormalDistribution
import org.apache.spark.mllib.clustering.KMeansModel
import org.apache.spark.mllib.linalg.{Vector, Vectors}

object SyntheticDataGenerator extends App{

  // Model for generating data
  // ----------------------------------------------------------------
    val Ts = 1; // Time sampling (ms)
    val model = new ClusterModel( Ts );

  // Kafka consumer --> Updates the model when a msn is received
  // ----------------------------------------------------------------
    val zooKeeper = "localhost:2181"
    val groupId   = "default"
    val topic     = "dataGenModel"
    val consumer: CustomKafkaConsumer = new CustomKafkaConsumer( zooKeeper, groupId, topic )

    consumer.run( model )

  // Create a network producer --> Data to Spark streaming through a socket
  // ----------------------------------------------------------------
    val listener = new ServerSocket( 9999 )
    println( "Listening on port: 9999" )

    while( true ) {
      val socket = listener.accept()

      // Continuous data generation
      // ******************************
      new Thread() {
        override def run = {
          println( "Got client connected from: " + socket.getInetAddress )

          var t = 0
          var sampleCounter = 0

          val out = new PrintWriter( socket.getOutputStream(), true )

          while( !socket.isOutputShutdown ) {
            try {
              // Generate new sample
              val sample = model.drawSample()

              // Stdout Info
              if( sampleCounter % 100 == 0 )
                println(
                  "Sample: " + sampleCounter +
                  " Centroid: " + sample._1.mkString( " ") +
                  " Cost: " +     sample._2 +
                  " Data: " +     sample._3.mkString(" ")
                )

              // Sending sample:  "realcost -> x,y"
              out.write( sample._2 + " -> " + sample._3.mkString(",") )
              out.write("\n"); out.flush()

            } catch {
              case e: Exception => {}
            }

            sampleCounter += 1
            t += model.ts

            // Wait
            Thread.sleep( model.ts )
          }
          socket.close()
        }
      }.start()
    }

}
