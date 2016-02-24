### Mosca MQTT server ++

  A MQTT borker based Mosca, with HTTP hooks and more functions.

### Installation

~~~~
  $ apt-get install libzmq-dev
  $ npm install
  $ nodejs server.js
~~~~

### Issues

  You may have errors when run the server script. Try following hacks.

~~~~
 vi node_modules/mosca/node_modules/ascoltatori/lib/redis_ascoltatore.js
~~~~

~~~~
  handler = function(sub, topic, payload) {
    debug("new message received for topic " + topic);
    util.defer(function() {
      // we need to skip out this callback, so we do not
      // break the client when an exception occurs
      var ascoltatore = that._ascoltatores[sub];
+     topic = topic.toString();
      ...
~~~~

### Lisence

The MIT License (MIT)