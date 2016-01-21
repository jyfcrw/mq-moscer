var config = {
    // MQTT server configuration, port, etc.
    mqtt: {
        port: 1883
    },

    // HTTP server and websocket configuration.
    http: {
        port: 1885
    },

    // HTTP hooks, the events emited will be
    // forwarded to specified url address.
    hook: {
        // auth_url is a hook for authenticating the connection of clients.
        // method: POST
        // params:
        //     cid,  client username
        //     mode, [digest], only 'digest' is available for now.
        //     ts,   timestamp
        // returns:
        //     token, a string digested by the following rule.
        // Authenticating rule is, token = md5(username + ":" + ts + ":" + password)

        //  auth_url: "http://localhost:3000/api/v1/auth",

        // auth_pub_url is a hook for authorization of publishing messages to topic.
        // method: POST
        // params:
        //     cid,   client username
        //     topic, specified topic pattern
        //     ts,    timestamp
        // returns:
        //     mode:  [basic], only 'basic' for now
        //     value: a boolean value

        //  auth_pub_url: "http://localhost:3000/api/v1/auth/pub",

        // auth_sub_url is a hook for authorization of subscribing topic.
        // method: POST
        // params:
        //     cid,   client username
        //     topic, specified topic pattern
        //     ts,    timestamp
        // returns:
        //     value: a boolean value

        //  auth_sub_url: "http://localhost:3000/api/v1/auth/sub",

        // client_url is a hook for client state notification.
        // method: POST
        // params:
        //     cid,   client username
        //     state, [online|offline]
        //     ts,    timestamp
        // returns:
        //     no returns
        //  client_url: "http://localhost:3000/api/v1/client",

        // message_url is a hook for message forwarding.
        // method: POST
        // params:
        //     cid,      client username
        //     topic,    specified topic pattern
        //     payload,  message content
        //     ts,       timestamp
        // returns:
        //     no returns
        //  message_url: "http://localhost:3000/api/v1/message"
    },

    // Redis channel name, messages published in the channel, will be
    // published to specified MQTT topic.
    // the format is {topic: "xxx", payload: "xxx"} in json.
    // ex. PUBLISH "mq:listener" "\{\"topic\":\"test\",\"payload\":\"Hello\"\}"
    listener: "mq:listener",

    // Redis configuration, host or port, etc.
    redis: {},

    // Debug switch
    debug: true
};

module.exports = config;