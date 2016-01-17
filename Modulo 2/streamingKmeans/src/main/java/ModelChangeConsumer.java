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
    public double[]   mean;
    public double[][] cov;
}

public class ModelChangeConsumer implements Runnable {

    private KafkaStream m_stream;
    private ChangeModelMsg changeModelMsg;

    /** Constructor */
    public ModelChangeConsumer( KafkaStream a_stream, ChangeModelMsg changeModelMsg ) {
        this.m_stream       = a_stream;
        this.changeModelMsg = changeModelMsg;
    }

    public void run() {

        ConsumerIterator<byte[], byte[]> it = m_stream.iterator();
        while( it.hasNext() ){

            // Reading Json message
                String changeMsg = new String( it.next().message() );

                changeModelMsg.set( changeMsg );


            System.out.println( "Msg: " + changeMsg );
        }

        System.out.println( "Shutting down Thread: ");
    }
}