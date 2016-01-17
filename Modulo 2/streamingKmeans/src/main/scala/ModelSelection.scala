import org.apache.spark.mllib.clustering.{StreamingKMeansModel, StreamingKMeans}
import org.apache.spark.mllib.linalg.{Vector, Vectors}

import scala.util.Random


object ModelSelection {

  def selectModel( evaluatedModels: Array[(StreamingKMeansModel, ClusteringStats)] ): Int ={

      val costs:   Array[Double] = evaluatedModels.map( m => m._2.cost     )
      val syIndex: Array[Double] = evaluatedModels.map( m => m._2.nSaIndex )

      println( "\tCosts " + costs.mkString(" , ") )
      println( "\tIndex " + syIndex.mkString(" , ") )

      // Relative cost
        val relCost: Array[Double] = costs.map( x => Math.abs( ( x-costs.min )/ ( costs.max - costs.min) ) )
        println( "\trel Costs " + relCost.mkString(" , ") )

        val relCost2 = for ( i <- 0 until costs.length ) yield {
          if( i == 0 || i == costs.length -1 ) 0.0
          else (costs(i-1)/costs(i) ) - (costs(i)/costs(i+1))
        }
        println( "\trel Costs2 " + relCost2.mkString(" , ") )

      // Selection by cost
        val indexSelected = relCost2.foldLeft( 0, Double.MinValue, 0 ) {
          case ( (selIndex, selValue, currentIndex), currentValue ) =>
            if( currentValue > selValue) ( currentIndex,currentValue,currentIndex+1 )
            else (selIndex, selValue, currentIndex+1 )
        } ._1

      // Selection by mixture of cost and homegeneity
      /*val alpha = 0.5
        val values: Array[Double] = ( for(i <- 0 to costs.length-2 ) yield  alpha*relCost(i) + (1 -alpha)*syIndex(i)/syIndex.max ).toArray

        println( "\tValues " + values.mkString(" , ") )
        val indexSelected = values.foldLeft( 0, Double.MaxValue, 0 ) {
          case ( (selIndex, selValue, currentIndex), currentValue ) =>
            if( currentValue < selValue) ( currentIndex,currentValue,currentIndex+1 )
            else (selIndex, selValue, currentIndex+1 )
        } ._1*/

      println( "\n\tOptimal K: " + evaluatedModels( indexSelected)._2.k )

    indexSelected
  }


  /** Experimental - Generate new streamingKMeans models re-using centroids of other model */
  /*  def getNewStreamingModel( actualModel:ClusteringStats, newK:Int, decay:Double ): StreamingKMeans ={

      var newModel:StreamingKMeans = null

      val desiredPropSamples = 1 / newK

      // Sorting centroids by difference with desired sample proportion
      val centPer =
        for( i <- 0 until actualModel.k )
          yield ( actualModel.centroids(i),
            Math.abs( desiredPropSamples - actualModel.nSaPerCluster(i).toDouble / actualModel.nSa )
            )

      // Generate a model with less clusters
      // ---------------------------------------------
      if( newK < actualModel.k  ){

        val newCnt = centPer.sortBy( _._2 ).map(a =>  Vectors.dense( a._1 )).take( newK ).toArray
        newModel = new StreamingKMeans()
                        .setK( newK )
                        .setDecayFactor( decay )
                        .setInitialCenters( newCnt, Array.fill(newK){0.0} )

      }


      //  Generate a model with more clusters
      // ---------------------------------------------
      if( newK > actualModel.k  ){

        val nNewCent = newK - actualModel.k

        // Splitting some centroids
        if( nNewCent < actualModel.k ) {

          val sortCnt = centPer.sortBy(_._2).map(a => Vectors.dense(a._1)).toArray

          val newCnt: Array[Vector] = Array.tabulate(newK)(i => {

            if (i < actualModel.k - nNewCent) {
              sortCnt(i)
            } else {
              val ii = (i - (actualModel.k - nNewCent)) / 2
              val random = new Random()
              Vectors.dense(sortCnt(actualModel.k - nNewCent + ii).toArray.map(v => v + random.nextGaussian()))
            }
          })

          newModel = new StreamingKMeans()
            .setK(newK)
            .setDecayFactor(decay)
            .setInitialCenters(newCnt, Array.fill(newK) {
              0.0
            })

        // Random initialization
        }else{
          newModel = new StreamingKMeans()
            .setK(newK)
            .setDecayFactor(decay)
            .setRandomCenters(2,0.0)
        }

      }

      newModel
    }*/

}
