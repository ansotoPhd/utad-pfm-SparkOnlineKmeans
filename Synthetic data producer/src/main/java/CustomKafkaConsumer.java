/**
 * Created by asoriano on 8/12/15.
 */

import kafka.consumer.ConsumerConfig;
import kafka.consumer.KafkaStream;
import kafka.javaapi.consumer.ConsumerConnector;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class CustomKafkaConsumer {

    private static final int N_THREADS = 1;

    private final ConsumerConnector consumer;
    private final String topic;

    private  ExecutorService executor;

    /** Constructor */
    public CustomKafkaConsumer( String a_zookeeper, String a_groupId, String a_topic ) {
        ConsumerConfig conf = createConsumerConfig( a_zookeeper, a_groupId );
        consumer    = kafka.consumer.Consumer.createJavaConsumerConnector( conf );
        this.topic  = a_topic;
    }

    public void shutdown() {
        if (consumer != null) consumer.shutdown();
        if (executor != null) executor.shutdown();
        try {
            if (!executor.awaitTermination(5000, TimeUnit.MILLISECONDS)) {
                System.out.println("Timed out waiting for consumer threads to shut down, exiting uncleanly");
            }
        } catch (InterruptedException e) {
            System.out.println("Interrupted during shutdown, exiting uncleanly");
        }
    }

    public void run( ClusterModel clusterModel ) {

        Map<String, Integer> topicCountMap = new HashMap<String, Integer>();
        topicCountMap.put( topic, new Integer( N_THREADS ) );

        Map<String, List<KafkaStream<byte[], byte[]>>> consumerMap = consumer.createMessageStreams(topicCountMap);
        List<KafkaStream<byte[], byte[]>> streams = consumerMap.get(topic);

        // now launch all the threads
        executor = Executors.newFixedThreadPool( N_THREADS );

        // now create an object to consume the messages
        for( final KafkaStream stream : streams ) {
            executor.submit( new ModelChangeConsumer( stream, clusterModel ) );
        }
    }

    private static ConsumerConfig createConsumerConfig( String a_zookeeper, String a_groupId ) {

        Properties props = new Properties();
            props.put("zookeeper.connect", a_zookeeper);
            props.put("group.id", a_groupId);
            props.put("zookeeper.session.timeout.ms", "400");
            props.put("zookeeper.sync.time.ms", "200");
            props.put("auto.commit.interval.ms", "1000");

        return new ConsumerConfig( props );
    }

}