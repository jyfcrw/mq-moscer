var mosca = require('mosca'),
    http  = require('http'),
    redis = require('redis'),
    request = require('request'),
    cache = require('memory-cache'),
    crypto = require('crypto');

var config = require('./config');
var rcListenerChannel = config.listener || "mq:listener";

var mqDataPrefix = "DAT",
    mqLotPrefix = "LOT",
    mqPrefixSet = [ mqDataPrefix, mqLotPrefix ];

var mqBackendSettings = {
    type: 'redis',
    redis: redis,
    db: 12,
    host: config.redis.host || "localhost",
    port: config.redis.port || 6379,
    return_buffers: true
};

var mqSettings = {
    port: config.mqtt.port || 1883,
    backend: mqBackendSettings,
    persistence: {
        factory: mosca.persistence.Redis
    }
};

var mqAuthenticateHandle = function(client, username, password, callback) {
    if (!config.hook.auth_url) {
        callback(null, true);
        return;
    }

    if (!(username && password)) {
        callback(null, false);
        return;
    }

    if (config.debug && username.substring(0, 6) === "000000") {
        callback(null, true);
        return;
    }

    var cacheKey = function() {
        return 'authentication:' + username;
    };

    var authenticateToken = function(ts) {
        return crypto.createHash('md5')
            .update(username + ":" + ts + ":" + password.toString())
            .digest('hex');
    };

    var signature = cache.get(cacheKey());
    if (signature) {
        var authorized = (signature.token === authenticateToken(signature.timestamp));
        if (authorized) client.user = username;
        callback(null, authorized);
        return;
    }

    signature = { timestamp: Date.now() };
    request.post({
        url: config.hook.auth_url,
        json: true,
        form: {
            cid: username,
            mode: "digest",
            ts: signature.timestamp
        }
    }, function (err, resp, body) {
        if ( resp && resp.statusCode == 200 ) {
            signature.token = body.token;
            cache.put(cacheKey(), signature, 1000 * 60 * 5);
        }
        console.log('Client signature updated', err.toString());

        var authorized = (signature.token === authenticateToken(signature.timestamp));
        if (authorized) client.user = username;
        callback(null, authorized);
    });
};

var mqAuthorizePublishHandle = function(client, topic, payload, callback) {
    if (!config.hook.auth_pub_url) {
        callback(null, true);
        return;
    }

    if (config.debug && client.user && client.user.substring(0, 6) === "000000") {
        callback(null, true);
        return;
    }

    fields = topic.split("/");
    if (fields.length > 1 &&
       mqPrefixSet.indexOf(fields[0]) >= 0 &&
       fields[1] === client.user) {
        callback(null, true);
        return;
    }

    var cacheKey = function() {
        return 'authorization:pub:' + client.user + ":" + topic;
    };

    var authorizePublish = function(passport) {
        var authorized = false;
        if (passport.mode === "basic") {
            authorized = !!passport.value;
        }
        return authorized;
    };

    var passport = cache.get(cacheKey());
    if (passport) {
        callback(null, authorizePublish(passport));
        return;
    }

    passport = { timestamp: Date.now() };
    request.post({
        url: config.hook.auth_pub_url,
        json: true,
        form: {
            cid: client.user,
            topic: topic,
            ts: passport.timestamp
        }
    }, function (err, resp, body) {
        if ( resp && resp.statusCode == 200 ) {
            passport.mode = body.mode || "basic";
            passport.value = body.value;
            cache.put(cacheKey(), passport, 1000 * 60 * 5);
        }

        console.log('Client pub passport updated', err.toString());
        callback(null, authorizePublish(passport));
    });
};

var mqAuthorizeSubscribeHandle = function(client, topic, callback) {
    if (!config.hook.auth_sub_url) {
        callback(null, true);
        return;
    }

    if (config.debug && client.user && client.user.substring(0, 6) === "000000") {
        callback(null, true);
        return;
    }

    fields = topic.split("/");
    if (fields.length > 1 &&
       mqPrefixSet.indexOf(fields[0]) >= 0 &&
       fields[1] === client.user) {
        callback(null, true);
        return;
    }

    var cacheKey = function() {
        return 'authorization:sub:' + client.user + ":" + topic;
    };

    var authorizeSubscribe = function(passport) {
        return !!passport.value;
    };

    var passport = cache.get(cacheKey());
    if (passport) {
        callback(null, authorizeSubscribe(passport));
        return;
    }

    passport = { timestamp: Date.now() };
    request.post({
        url: config.hook.auth_sub_url,
        json: true,
        form: {
            cid: client.user,
            topic: topic,
            ts: passport.timestamp
        }
    }, function (err, resp, body) {
        if ( resp && resp.statusCode == 200 ) {
            passport.value = body.value;
            cache.put(cacheKey(), passport, 1000 * 60 * 5);
        }

        console.log('Client sub passport updated', err.toString());
        callback(null, authorizeSubscribe(passport));
    });
};

var mqClientConnectedHandle = function(client) {
    console.log('Client connected', client.id);

    if (!config.hook.client_state_url) return;

    request.post({
        url: config.hook.client_state_url,
        form: {
            cid: client.user,
            state: "online",
            ts: Date.now()
        }
    }, function (err, resp, body) {
        console.log('Client state updated [online]', err.toString());
    });
};

var mqClientDisconnectingHandle = function(client) {
    console.log('Client disconnecting:', client.id);
};

var mqClientDisconnectedHandle = function(client) {
    console.log('Client disconnected:', client.id);

    if (!config.hook.client_state_url) return;

    request.post({
        url: config.hook.client_state_url,
        form: {
            cid: client.user,
            state: "offline",
            ts: Date.now()
        }
    }, function (err, resp, body) {
        console.log('Client state updated [offline]', err.toString());
    });
};

var mqPublishedHandle = function(packet, client) {
    if (!client) return;

    console.log('Published', packet.payload);

    fields = packet.topic.split("/");

    if (config.hook.client_data_url &&
        fields.length > 1 &&
        fields[0] == mqDataPrefix &&
        fields[1] == client.user) {
        request.post({
            url: config.hook.client_data_url,
            form: {
                cid: client.user,
                key: fields.slice(2).join("/").trim(),
                data: packet.payload.toString(),
                ts: Date.now()
            }
        }, function (err, resp, body) {
            console.log('Client data updated', err.toString());
        });
    }

    if (config.hook.message_url) {
        request.post({
            url: config.hook.message_url,
            form: {
                cid: client.user,
                topic: packet.topic,
                payload: packet.payload.toString(),
                ts: Date.now()
            }
        }, function (err, resp, body) {
            console.log('Client message forwarded', err.toString());
        });
    }
};

var mqSetupHandle = function() {
    mqttServer.authenticate = mqAuthenticateHandle;
    mqttServer.authorizePublish = mqAuthorizePublishHandle;
    mqttServer.authorizeSubscribe = mqAuthorizeSubscribeHandle;
    console.log('MQTT Moscer server is up and running');
};

var rcSubscribeHanlde = function(channel, count) {
    console.log('Listener is ready on channel:', '<' + channel + '>');
};

var rcMessageHandle = function (channel, message) {
    if (channel === rcListenerChannel) {
        try {
            var packet = JSON.parse(message);
            if (packet && packet.topic) {
                mqttServer.ascoltatore.publish(packet.topic, packet.payload, function() {
                  console.log('Message published to the topic', packet.topic, packet.payload);
                });
            }
        } catch(e) {
            console.log('Message published error:', e.toString());
        }
    }
};

var httpServer = http.createServer();

var mqttServer = new mosca.Server(mqSettings);
mqttServer.on('ready', mqSetupHandle);
mqttServer.on('clientConnected', mqClientConnectedHandle);
mqttServer.on('clientDisconnecting', mqClientDisconnectingHandle);
mqttServer.on('clientDisconnected', mqClientDisconnectedHandle);
mqttServer.on('published', mqPublishedHandle);
mqttServer.attachHttpServer(httpServer);

var redisClient = redis.createClient();
redisClient.subscribe(rcListenerChannel);
redisClient.on("subscribe", rcSubscribeHanlde);
redisClient.on("message", rcMessageHandle);

httpServer.listen(config.http.port || 1885);