# utad-pfm-SparkOnlineKmeans

Proyecto final de master "Experto en Big data" de U-TAD


Json file (Model specification) --> Scala Producer (data generation)--> Socket --> Spark Streaming (data processing) --> Kafka
--> Server ( kafka-websocket ) --> Websocket --> Front-End (D3.js)


Servidor de websokets conectado a kafka
----------------------------------------

https://github.com/b/kafka-websocket


Web UI de Kafka
-----------------------------
https://github.com/yahoo/kafka-manager