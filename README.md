##Proyecto final de curso "Experto en Big data" - U-TAD

El objetivo del trabajo final del curso “Experto en Big Data” es el de realizar un proyecto en el que se ponga en práctica alguno o varios de los conceptos y tecnologías aprendidos en el programa, alentando a los alumnos a que, en caso de ser posible, incluyan otras tecnologías Big Data no vistas durante el curso. 

----------------------------------------

# Técnicas de Machine Learning en Spark Streaming

El objetivo de este proyecto es estudiar la aplicabilidad de técnicas de machine learning ante streams de datos, centrándose este caso en métodos de segmentación o clusterización de datos utilizando la tecnología Spark Streaming.

La libreria de machine learning incorporada en Apache Spark (MLlib) contiene una implementación del método K-Means para ser utilizada con streams de datos. Esta implementación está basada en una variante del algoritmo *Mini-Batch K-Means*. 

El desarrollo del presente trabajo final de curso se ha dividido en las siguientes etapas:

* Estudio teórico del modelo de clustering K-Means y del algoritmo de Lloyd, uno de los más utilizados en la resolución del problema de optimización que se plantea en el entrenamiento del modelo. El algoritmo de Lloyd es un algoritmo de procesado *Batch* que utiliza una técnica de refinamiento iterativo basada en descenso por gradiente para la resolución del problema de optimización. 

* Estudio de la variante del algoritmo de Lloyd para la resolución del problema utilizando *Mini-Batches*.

* Estudio del algoritmo *Streaming K-Means*, basado en la implementación *Mini-Batch K-Means*, siendo ésta modificada para permitir el entrenamiento continuado del modelo utilizando datos en streaming cuya distribución puede no ser temporalmente estacionaria.

* Implementación pŕactica de una aplicación de test que posibilite la comparación entre las versiones *Batch* y *Mini-Batch* del algoritmo.

* Implementación de un prototipo de sistema de procesado de datos en streaming donde se utilice el algoritmo *Streaming K-Means*.
