
/** Class for thread-safe reading messages for changing algorithm parameters */
class ChangeModelMsg( var msg: String ){

  def set( newMsg: String) {
    this.synchronized {
      msg = newMsg
    }
  }
  def get(): String = synchronized {
    val out = msg
    msg = ""
    out
  }
}

/** Deserialized received message */
case class KmeansModel(
  var mode:String,
  var decay:Double,
  var k:Option[Int],
  var kmin:Option[Int],
  var kmax:Option[Int]
)

