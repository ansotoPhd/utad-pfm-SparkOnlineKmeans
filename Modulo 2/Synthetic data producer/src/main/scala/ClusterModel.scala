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