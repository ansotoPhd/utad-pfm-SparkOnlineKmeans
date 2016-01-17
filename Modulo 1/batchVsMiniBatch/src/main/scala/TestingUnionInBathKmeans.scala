import org.apache.log4j.{Level, Logger}
import org.apache.spark.mllib.clustering.{KMeans, KMeansModel}
import org.apache.spark.mllib.linalg.Vector
import org.apache.spark.rdd.RDD
import org.apache.spark.{SparkContext, SparkConf}

/**
  * Created by asoriano on 9/01/16.
  */

object TestingUnionInBathKmeans extends App{

  // Disabling loggers
    Logger.getLogger("org").setLevel(Level.OFF)
    Logger.getLogger("akka").setLevel(Level.OFF)

  // Spark conf and context
    val numCores = 6
    val conf = new SparkConf().setMaster("local["+numCores+"]")
                              .setAppName("ComparingBatchStreamingKmeans")
                              .set("spark.driver.memory","8G")
    val sc   = new SparkContext(conf)

  // Parameters
    val nPoints       = 10000000   // Total number of samples
    val nPtsMiniBatch = 50000     // Samples in each mini-batch
    val nCentroids    = 10        // Number of clusters
    val dimension     = 5         // Dimension of clusters

  // Generate centers
    val gaussScale    = 10
    val centers = DataGenerator.generateCenters( nCentroids, dimension, gaussScale )


  println( "---------------------------------------------------------------------" )
  println( " Generating all data in one RDD " )
  println( "---------------------------------------------------------------------" )

    val dataRDD = DataGenerator.kmeansDataRDD(sc, nPoints,centers,6)
    dataRDD.cache()

    // Compute cost using real centers
      val realModel = new KMeansModel( centers )
      val realCost: Double = realModel.computeCost( dataRDD )/nPoints

    // Summary
      println( "\tNum. points: " + dataRDD.count )
      println( "\tReal cost: " + realCost )
      println( "\tCenters: ")
      Utils.sortVectors(centers).foreach( c => println("\t\t" + c) )

  println( "\n***********************************" )
  println( "Batch - All data in one RDD " )
  println( "***********************************" )

    // Create Kmeans model
      val batchModel: KMeans = new KMeans()
      batchModel.setK( nCentroids ).setEpsilon( 1e-4 )
        .setInitializationMode( "k-means||" )
        .setInitializationSteps( 3 ).setMaxIterations( 100 )
        .setRuns( 5 )

    // Train model
      val start = System.nanoTime()
      val batchKmeansModel: KMeansModel = batchModel.run( dataRDD )
      val end = System.nanoTime()
      val batchTime = (end-start)/1e9

    // Compare real model with trained model
      val batchCentroids: Array[Vector] = batchKmeansModel.clusterCenters
      val batchKmeansCost = batchKmeansModel.computeCost( dataRDD )/nPoints
      val batchCenterError = Utils.errorCentroids( centers, batchCentroids )

    // Summary
      println( "\tBatch - Training time: " + batchTime )
      println( "\tBatch cost: " + batchKmeansCost )
      println( "\tBatch centers error: " + batchCenterError )
      println( "\tCenters: ");  Utils.sortVectors( batchCentroids ).foreach( c => println("\t\t" + c) )

    dataRDD.unpersist( true )


  println( "\n---------------------------------------------------------------------" )
  println( " Generating data in several RDD and combining them " )
  println( "---------------------------------------------------------------------" )

  val dataArrayRDD = DataGenerator.kmeansDataArrayRDD( sc,nPtsMiniBatch,nPoints/nPtsMiniBatch,centers,6 )
  var dataRDD2: RDD[Vector] = dataArrayRDD(0)
  for( i <- 1 to dataArrayRDD.length-1 )
    dataRDD2 = dataRDD2.union( dataArrayRDD(i) )
  dataRDD2 = dataRDD2.coalesce(6,false)
  dataRDD2.cache()

  // Compute cost using real centers
    val realModel2 = new KMeansModel( centers )
    val realCost2: Double = realModel2.computeCost( dataRDD2 )/nPoints

  // Summary
    println( "\tNum. points: " + dataRDD2.count )
    println( "\tReal cost: " + realCost2 )
    println( "\tCenters: ")
    Utils.sortVectors(centers).foreach( c => println("\t\t" + c) )


  println( "\n***********************************" )
  println( "Batch - Data in several RDD " )
  println( "***********************************" )

  // Create Kmeans model
    val batchModel2: KMeans = new KMeans()
    batchModel2.setK( nCentroids ).setEpsilon( 1e-4 )
      .setInitializationMode( "k-means||" )
      .setInitializationSteps( 3 ).setMaxIterations( 100 )
      .setRuns( 5 )

  // Train model
    val start2 = System.nanoTime()
    val batchKmeansModel2: KMeansModel = batchModel2.run( dataRDD2 )
    val end2 = System.nanoTime()
    val batchTime2 = (end2-start2)/1e9

  // Compare real model with trained model
    val batchCentroids2: Array[Vector] = batchKmeansModel2.clusterCenters
    val batchKmeansCost2 = batchKmeansModel2.computeCost( dataRDD2 )/nPoints
    val batchCenterError2 = Utils.errorCentroids( centers, batchCentroids2 )

  // Summary
    println( "\tBatch - Training time: " + batchTime2 )
    println( "\tBatch cost: " + batchKmeansCost2 )
    println( "\tBatch centers error: " + batchCenterError2 )
    println( "\tCenters: ");  Utils.sortVectors( batchCentroids2 ).foreach( c => println("\t\t" + c) )

  dataRDD2.unpersist()

}
