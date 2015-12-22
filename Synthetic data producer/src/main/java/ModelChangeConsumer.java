/**
 * Created by asoriano on 8/12/15.
 */
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import kafka.consumer.ConsumerIterator;
import kafka.consumer.KafkaStream;
import org.apache.commons.math3.distribution.MultivariateNormalDistribution;

import java.lang.reflect.Type;
import java.util.ArrayList;


class ModelMsg{
    public double P;
    public double[] mean;
}

public class ModelChangeConsumer implements Runnable {

    private KafkaStream  m_stream;
    private ClusterModel clusterModel;

    /** Constructor */
    public ModelChangeConsumer( KafkaStream a_stream, ClusterModel clusterModel ) {
        this.m_stream     = a_stream;
        this.clusterModel = clusterModel;
    }

    public void run() {

        ConsumerIterator<byte[], byte[]> it = m_stream.iterator();
        while( it.hasNext() ){

            // Reading Json message
                String changeMsg = new String( it.next().message() );

            // Deserializing it
                Gson gson = new Gson();
                Type listType = new TypeToken<ArrayList<ModelMsg>>() {}.getType();
                ArrayList<ModelMsg> readedModel = gson.fromJson( changeMsg, listType );

            // Updating clusterModel

                // Categorical distribution --> With normalization
                    float totalProb = 0;
                    for( ModelMsg comp: readedModel )
                        totalProb += comp.P;
                    double[] probs = new double[readedModel.size()];
                    for( int i=0; i< readedModel.size(); i++ )
                        probs[i] = 1.0 / readedModel.size();
                        //probs[i] = readedModel.get(i).P / totalProb;
                    this.clusterModel.updateCategoricalDist( probs );

                // Gaussian dists
                    double[][] cov = {{1,0},{0,1}};
                    MultivariateNormalDistribution[] gaussians = new MultivariateNormalDistribution[readedModel.size()];
                    for( int i=0; i< readedModel.size(); i++ )
                        gaussians[i] = new MultivariateNormalDistribution( readedModel.get(i).mean, cov );
                    this.clusterModel.updateMvGaussians( gaussians );

                // kmeansModel
                    this.clusterModel.createKmeansModel();


            System.out.println( "Msg: " + changeMsg );
        }

        System.out.println( "Shutting down Thread: ");
    }
}