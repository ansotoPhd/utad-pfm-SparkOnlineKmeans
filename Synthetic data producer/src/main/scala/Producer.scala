import java.io.{PrintWriter, InputStream}
import java.net.ServerSocket

import breeze.linalg.DenseVector
import breeze.stats.distributions.Multinomial
import org.apache.commons.math3.distribution.MultivariateNormalDistribution
import org.json4s.DefaultFormats


object Producer extends App{

  case class MultinomialDist( var probs:Array[Double] )

  case class MvGaussian( means:Array[Double], cov:Array[Array[Double]])

  case class Event(
                    t         : Int,
                    eventType : String,
                    probs     : Option[ Array[Double] ],
                    nCluster  : Option[ Int ],
                    means     : Option[ Array[Double] ],
                    cov       : Option[ Array[Array[Double]] ]
                  )

  case class ClusterModel( val ts:Int, var events: Array[Event], clusterSelector: MultinomialDist, clusters: Array[MvGaussian] ){

    var  categoricalDist = Multinomial( DenseVector( clusterSelector.probs ) )
    var  mvGaussianArray = for (x <- clusters)
      yield new MultivariateNormalDistribution( x.means, x.cov )

    // ( cluster label, sample )
    def drawSample(): ( Int, Array[Double] ) ={

      // Obtaining cluster number which will generate the new sample
      val clusterNum = this.categoricalDist.draw();
      // New sample
      ( clusterNum, this.mvGaussianArray( clusterNum ).sample() )
    }

  }

  // Reading model definition from Json; deserializating it.
  implicit val formats = DefaultFormats

  val stream:InputStream = getClass.getResourceAsStream("/model.txt")
  val modelDef = scala.io.Source.fromInputStream( stream ).mkString
  val json  = org.json4s.native.JsonMethods.parse( modelDef )
  val model = json.extract[ClusterModel]


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

          // Events processing
          // --------------------------------------------
            val events = model.events.filter( _.t <= t )
            if( events.size > 0 ){
              for( e <- events )
                e.eventType match {
                  case "changeSelector" =>{
                    //model.clusterSelector.probs = e.probs.get
                    model.categoricalDist = Multinomial( DenseVector( e.probs.get ) )
                  }
                  case "changeCluster" =>{
                    //model.clusters(e.nCluster.get) = new MvGaussian( e.means.get, e.cov.get )
                    model.mvGaussianArray = for( x <- model.clusters )
                      yield new MultivariateNormalDistribution( e.means.get, e.cov.get)
                  }
                }
              model.events = model.events.filter( _.t > t )
            }

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
