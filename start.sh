#!/bin/bash

echo "[start] Launching IBKR Gateway on port 5000..."
java -Dvertx.disableDnsResolver=true \
     -Djava.net.preferIPv4Stack=true \
     -Dvertx.logger-delegate-factory-class-name=io.vertx.core.logging.SLF4JLogDelegateFactory \
     -Dnologback.statusListenerClass=ch.qos.logback.core.status.OnConsoleStatusListener \
     -Dnolog4j.debug=true -Dnolog4j2.debug=true \
     -classpath "root:dist/ibgroup.web.core.iblink.router.clientportal.gw.jar:build/lib/runtime/*" \
     ibgroup.web.core.clientportal.gw.GatewayStart &

echo "[start] Waiting for gateway to start..."
sleep 8

echo "[start] Launching proxy on port 10000..."
node proxy.js
