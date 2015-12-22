import java.util.Properties

import org.apache.kafka.clients.producer.{ProducerRecord, KafkaProducer}

/**
  * Created by asoriano on 22/12/15.
  */


class KafkaSink( createProducer: () => KafkaProducer[String, String] ) extends Serializable {

  lazy val producer = createProducer()

  def send( topic: String, value: String ): Unit = producer.send( new ProducerRecord( topic, value ) )
}

object KafkaSink {

  def apply( config: Properties ): KafkaSink = {

    val f = () => {
      new KafkaProducer[String, String]( config )
    }

    new KafkaSink( f )
  }

}
