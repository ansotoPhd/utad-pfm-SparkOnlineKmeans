import org.apache.spark.mllib.linalg.{Vectors, Vector}

/**
  * Created by asoriano on 9/01/16.
  */

object Utils {

  /** Sorts an array of vectors by their norm */
  def sortVectors( vectors: Array[Vector] ) = {
    vectors.sortWith( (v1, v2) => Vectors.norm(v1,2) < Vectors.norm(v2,2) )
  }

  /** List generator with all possible combinations of a set of list */
  def combine[A](xs: Traversable[Traversable[A]]): Seq[Seq[A]] =
    xs.foldLeft(Seq(Seq.empty[A])){
      (x, y) => for (a <- x.view; b <- y) yield a :+ b
    }

  /** Computes an error index beetween two sets of vectors **/
  def errorCentroids( c1:Array[Vector], c2:Array[Vector] ): Double = {
    var l = c2.toList
    val dist: Array[Double] =
      for( v1 <- c1 ) yield {
        val d: List[Double] = for( v2 <- l ) yield Math.sqrt( Vectors.sqdist(v1,v2) )
        // (min.distance, vector)
        val (d1,v) = d.zip(l).minBy( _._1)
        l = l.filter( _ != v )
        d1
      }

    dist.sum
  }

}
