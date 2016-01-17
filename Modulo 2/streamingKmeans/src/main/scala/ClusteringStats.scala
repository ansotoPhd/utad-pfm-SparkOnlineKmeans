import org.apache.spark.mllib.clustering.StreamingKMeansModel
import org.apache.spark.mllib.linalg.{Vectors, Vector}
import org.apache.spark.rdd.RDD
import org.json4s.DefaultFormats
import org.json4s.native.Serialization._

/** Information extracted in each mini-batch model update */
case class ClusteringStats(
  k:   Int,                               // Number of clusters
  nSa: Int,                               // Number of samples in mini-batch
  cost: Double,                           // Value of distortion in mini-batch
  modelRealCost: Double,                  // Value of distortion 'real' in mini-batch
  centroids: Array[ Array[Double] ],      // Centroids
  nSaPerCluster:Array[Int],               // Number of mini-batch samples assigned to each cluster
  nSaIndex:Double,                        // Homogeneity in number of samples index
  meanDistPerCluster:Array[Double]        // Average distance of samples to their associated centroid
)

/** Extracting info from mini-batch clustering */
object ClusteringStats{

  def apply( rdd:RDD[Vector], modelRealCost:Double, trainedModel: StreamingKMeansModel ): ClusteringStats = {

    // Json deserializer parameter
      implicit val formats = DefaultFormats

    // Number of clusters
      val k: Int = trainedModel.k

    // Centroids
      val vCentroids: Array[Vector]       = trainedModel.clusterCenters
      val centroids: Array[Array[Double]] = vCentroids.map( _.toArray )

    // Cost
      val cost = trainedModel.computeCost( rdd );

    // Samples assigned to each cluster statistics
    //  ( centroid Index, (samples in cluster, avg.dist, min. dist, max.dist) )
      val clusterSamplesStats: Array[(Int, (Int, Double,Double,Double))] =
        rdd
          // ( Index of assigned cluster, sample )
          .map( v  => ( trainedModel.predict(v), v ) )
          // ( Index of assigned cluster, sample, assigned centroid)
          .map( cv => ( cv._1, cv._2, vCentroids( cv._1) ) )
          // ( Index of assigned cluster, distance of sample to cluster centroid )
          .map( cvv => ( cvv._1, Math.sqrt( Vectors.sqdist( cvv._2, cvv._3) ) ) )
          // Calculating average of distances for each cluster
          .aggregateByKey( (0.0,0, Double.MaxValue, Double.MinValue ) )(        // ZeroValue
          (acc, value ) => ( acc._1 + value, acc._2 + 1,
                             if( value < acc._3) value else acc._3,
                             if( value > acc._4) value else acc._4 ),           // SeqOp
          (acc1, acc2) => ( acc1._1 + acc2._1,  acc1._2 + acc2._2,
                            if( acc1._3 < acc2._3) acc1._3 else acc2._3,
                            if( acc1._4 > acc2._4)  acc1._4 else   acc2._4 )   // CombOp
          )
          .mapValues { case (sum,count,min,max) => (count, sum/count,min,max ) }.collect()

        val nSaTotal: Int                      = clusterSamplesStats.map(t => t._2._1 ).sum
        val nSaPerCluster:Array[Int]           = Array.fill(k){0}
        val meanDistToCentroids: Array[Double] = Array.fill(k){0.0}
        val minDistToCentroids: Array[Double]  = Array.fill(k){0.0}
        val maxDistToCentroids: Array[Double]  = Array.fill(k){0.0}

        clusterSamplesStats.foreach{
          case (cIndex,(nSa,avgDist,min,max)) => {
            nSaPerCluster(cIndex)       = nSa
            meanDistToCentroids(cIndex) = avgDist
            minDistToCentroids(cIndex)  = min
            maxDistToCentroids(cIndex)  = max
          }
        }

        // println( "Num.samples: " + nSaPerCluster.mkString(" , ") )
        // println( "Min.dist: " + minDistToCentroids.mkString(" , ") )
        // println( "Avg.dist: " + meanDistToCentroids.mkString(" , ") )
        // println( "Max.dist: " + maxDistToCentroids.mkString(" , ") )

    // Measuring "uniformity"
      // Shannon index
        val entropy    = -1*nSaPerCluster.map( ni => ni.toDouble/ nSaTotal.toDouble ).map( pi => pi*Math.log(pi) ).sum;
        val correction = ( trainedModel.k - 1).toDouble/(2*nSaTotal);
        val SE: Double = entropy + correction;
        var SY: Double = 1 - SE/Math.log(trainedModel.k);
        SY = if( SY < 0 ) 0.0 else SY

      // Other measure of uniformity
        val e = Math.sqrt( nSaPerCluster.map( ni => Math.pow(ni.toDouble/ nSaTotal.toDouble,2) ).sum)
        val eUnif = (e*Math.sqrt(k) - 1 )/ (Math.sqrt(k) - 1)

    // Distances between centroids
      /* if( k == vCentroids.length && k == meanDistToCentroids.length ) {
          val centroidsDist =
            for (i <- 0 to k - 2; j <- i + 1 to k - 1) yield {
              val dij = Math.sqrt(Vectors.sqdist(vCentroids(i), vCentroids(j)))
              Array( i, j, dij )
            }
          // println( write(centroidsDist ) )
        }*/

    // Output
      new ClusteringStats( k,nSaTotal,cost,modelRealCost,centroids, nSaPerCluster, eUnif, meanDistToCentroids )

  }
}