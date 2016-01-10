import org.apache.spark.SparkContext
import org.apache.spark.mllib.linalg.{Vectors, Vector}
import org.apache.spark.rdd.RDD

import scala.collection.immutable.IndexedSeq
import scala.util.Random

/**
  * Created by asoriano on 9/01/16.
  */

object DataGenerator {

  /** Generates random centers sampling a multivariate gaussian dist. */
  def generateCenters( nCenters: Int, dim:Int, scale:Double, seed:Int = 42 ): Array[Vector] = {

    val rand = new Random( seed )
    val centers = Array.fill(nCenters)( Array.fill(dim)( rand.nextGaussian() * scale ) )

    centers.map( Vectors.dense(_) )
  }

  /** Data generator - One RDD */
  def kmeansDataRDD(
        sc: SparkContext,             // Spark context
        numPoints: Int,               // Number of samples
        centers:Array[Vector],        // Centroids
        numPartitions: Int = 2        // Partitions for RDD

  ): RDD[Vector]  = {

    val k = centers.length    // Num. centroids
    val d = centers(0).size   // Dimension

    // Generate points around each center
    val data: RDD[Vector] =
      sc.parallelize(0 until numPoints, numPartitions)
        .map { idx =>
          val center = centers(idx % k)
          val rand2  = new Random()
          Array.tabulate(d)( i => center(i) + rand2.nextGaussian() )
        }
        .map( a => Vectors.dense(a) )

    data
  }

  /** Data generator - Several RDDs */
  def kmeansDataArrayRDD(
    sc: SparkContext,         // Spark context
    nRddPoints: Int,          // Number of samples per Rdd
    nRdds: Int,               // Number of Rdds
    centers:Array[Vector],    // Centroids
    numPartitions: Int = 2    // Partitions for generated RDD

  ): Array[RDD[Vector]] = {

    val k = centers.length    // Num. centroids
    val d = centers(0).size   // Dimension

    // Generate points around each center
    val data: IndexedSeq[RDD[Vector]] = for (i <- 1 to nRdds) yield
      sc.parallelize( 0 until nRddPoints, numPartitions )
        .map { idx =>
          val center = centers(idx % k)
          val rand2 = new Random()
          Array.tabulate(d)(i => center(i) + rand2.nextGaussian())
        }
        .map(a => Vectors.dense(a))

    data.toArray
  }

}
