import java.io.{PrintWriter, File}

import org.apache.log4j.{Level, Logger}
import org.apache.spark.mllib.clustering.{StreamingKMeansModel, StreamingKMeans, KMeans, KMeansModel}
import org.apache.spark.mllib.linalg.{Vectors, Vector}
import org.apache.spark.{SparkContext, SparkConf}

import scala.util.control.Breaks._


object BatchVsMiniBatch_kmeans extends App {

  // Disabling loggers
    Logger.getLogger("org").setLevel(Level.OFF)
    Logger.getLogger("akka").setLevel(Level.OFF)

  // Set of experiments
    val numCores          = 8
    val nCentroids        = 10
    val numRuns           = 10
    val numRep            = 5
    val numPtsMiniBatch   = 10000
    val listNumPoints     = List( 500000, 1000000, 5000000, 10000000 )
    val listDim           = List( 5, 10, 20 )

    val experiments = Utils.combine( List( listNumPoints, listDim ) )

  val writer = new PrintWriter( new File("/home/astwin/Escritorio/utad-pfm-SparkOnlineKmeans/batchVsMiniBatch/output/6c_results.csv" ) )
  writer.write( "Num. cores|"       +
                "Num. centroids|"   +
                "Num. runs|"        +
                "Num. repetitions|" +
                "Num. dimensions|"  +
                "Num. points|"      +
                "Num. points mini-batch|" +
                "Algorithm|"        +
                "Real.cost|"        +
                "Time|"             +
                "Cost|"             +
                "Centroids error\n"
              )

  // Spark conf and context
    val conf = new SparkConf().setMaster("local["+numCores+"]")
                              .setAppName("ComparingBatchStreamingKmeans")
                              .set("spark.driver.memory","8g")
    val sc   = new SparkContext(conf)


  for( experiment <- experiments ) {

    // Parameters
      val numPoints       = experiment(0)
      val dimensions      = experiment(1)


    println("\n------------------------------------------------------ ")
    println("=> Experiment" )
    println("------------------------------------------------------ ")

    // Summary
      println( "\tNumber of executors: " + numCores )
      println( "\tNumber of points: " + numPoints )
      println( "\tDimensions: " + dimensions )
      println( "\tNum. points in each mini-batch: " + numPtsMiniBatch )
      println( "\tNumber of clusters: " + nCentroids )
      println( "\tNumber of runs: " + numRuns )


    //  Generate synthetic data
    // ------------------------------------------------------------------

      // Generate centers
        val centers = DataGenerator.generateCenters( nCentroids, dimensions, 10 )

      // Generate data
        val dataArrayRDD =
          DataGenerator.kmeansDataArrayRDD( sc, numPtsMiniBatch, numPoints/numPtsMiniBatch, centers, numCores )
        val dataRDD = sc.union(dataArrayRDD  ).coalesce( numCores, false )
        dataRDD.cache()

      // Compute cost using real centers
        val realModel = new KMeansModel( centers )
        val realCost: Double = realModel.computeCost(dataRDD) / numPoints

      // Summary
        println("\n\tReal cost: " + realCost)
        println("\tCenters: ")
        Utils.sortVectors(centers).foreach( c => println("\t\t" + c) )


    for( i <- 1 to numRep ) {

      println("\n\t***********************************")
      println("\tBatch K-Means. Trial: " + i + "/" + numRep )
      println("\t***********************************")

      // Create Kmeans model
        val batchModel: KMeans = new KMeans()

      // Configuration of model
        batchModel.setK(nCentroids).setEpsilon(1e-4)
          .setInitializationMode("k-means||")
          .setInitializationSteps(3).setMaxIterations(100)
          .setRuns(numRuns)

      // Train model
        val start = System.nanoTime()
          val batchKmeansModel: KMeansModel = batchModel.run(dataRDD)
        val end = System.nanoTime()
        val batchTime = (end - start) / 1e9

      // Compare real model with trained model
        val batchCentroids: Array[Vector] = batchKmeansModel.clusterCenters
        val batchKmeansCost = batchKmeansModel.computeCost(dataRDD) / numPoints
        val batchCenterError = Utils.errorCentroids(centers, batchCentroids)

      // Summary
        println("\t\tBatch Time: " + batchTime + " s")
        println("\t\tBatch cost: " + batchKmeansCost)
        println("\t\tBatch centers error: " + batchCenterError)
        println("\t\tCenters: ")
        Utils.sortVectors(batchCentroids).foreach(c => println("\t\t\t" + c))

        writer.write(
          numCores        + "|" +
          nCentroids      + "|" +
          numRuns         + "|" +
          numRep          + "|" +
          dimensions      + "|" +
          numPoints       + "|" +
          numPtsMiniBatch + "|" +
          "Batch Kmeans"  + "|" +
          realCost        + "|" +
          batchTime       + "|" +
          batchKmeansCost + "|" +
          batchCenterError + "\n"
        )
    }


    for( i <- 1 to numRep ) {

      println("\n\t***********************************")
      println("\tMini-Batch K-Means. Trial: " + i + "/" + numRep)
      println("\t***********************************")

      dataArrayRDD.foreach(rdd => rdd.cache())

      // Models
      val streamingModels = new Array[StreamingKMeans](numRuns)
      for (i <- 0 until numRuns) {
        streamingModels(i) =
          new StreamingKMeans()
            .setK(nCentroids).setDecayFactor(1).setRandomCenters(dimensions, 0.0)
      }

      // Training models
      val start2 = System.nanoTime()
      breakable {
        for (rdd <- dataArrayRDD) {

          // Previous centroids
          val prevCentroids: Array[Array[Vector]] = for (m <- streamingModels) yield {
            val newV = for (v <- m.latestModel().clusterCenters) yield {
              Vectors.dense(v.toArray.clone())
            }
            newV
          }
          // Update models with data in one mini-batch
          streamingModels.foreach(m => m.latestModel().update(rdd, m.decayFactor, m.timeUnit))

          rdd.unpersist()

          // New centroids
          val newCentroids = streamingModels.map(_.latestModel().clusterCenters)

          // Measure change of centroids
          val e = prevCentroids.zip(newCentroids).map(c => Utils.errorCentroids(c._1, c._2)).sum

          // Test convergence
          if (e < 0.1) break
          // println( "\t\tError: " + e )

        }
      }
      val end2 = System.nanoTime()
      val minibatchTime = (end2 - start2) / 1e9

      // Select 'best' model
      val listModelsCost: Array[(Double, StreamingKMeansModel)] =
        for (m <- streamingModels) yield (m.latestModel().computeCost(dataRDD), m.latestModel())
      val selectedModel: (Double, StreamingKMeansModel) = listModelsCost.minBy(_._1)

      // Compare real model with trained model
      val minibatchCost: Double = selectedModel._1 / numPoints
      val minibatchCentroids: Array[Vector] = selectedModel._2.clusterCenters
      val minibatchCenterError = Utils.errorCentroids(centers, minibatchCentroids)

      // Summary
        println("\t\tMini-Batch Time: " + minibatchTime + " s")
        println("\t\tMini-Batch Cost = " + minibatchCost)
        println("\t\tMini-Batch centers error: " + minibatchCenterError)
        println("\t\tCenters: ")
        Utils.sortVectors(minibatchCentroids).foreach(c => println("\t\t\t" + c))

      writer.write(
        numCores        + "|" +
          nCentroids      + "|" +
          numRuns         + "|" +
          numRep          + "|" +
          dimensions      + "|" +
          numPoints       + "|" +
          numPtsMiniBatch + "|" +
          "Mini-Batch Kmeans"   + "|" +
          realCost              + "|" +
          minibatchTime         + "|" +
          minibatchCost         + "|" +
          minibatchCenterError  + "\n"
      )

    }

    dataRDD.unpersist( true )
  }

  writer.close()
  Console.readLine( "Press Enter to finalize execution." )
}
