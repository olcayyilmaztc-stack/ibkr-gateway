FROM eclipse-temurin:8-jre

WORKDIR /gateway

# Copy gateway files
COPY clientportal.gw/ .

# Use conf.yaml from our custom config
COPY conf.yaml root/conf.yaml

EXPOSE 5000

CMD ["java", "-Dvertx.disableDnsResolver=true", \
     "-Djava.net.preferIPv4Stack=true", \
     "-Dvertx.logger-delegate-factory-class-name=io.vertx.core.logging.SLF4JLogDelegateFactory", \
     "-Dnologback.statusListenerClass=ch.qos.logback.core.status.OnConsoleStatusListener", \
     "-Dnolog4j.debug=true", "-Dnolog4j2.debug=true", \
     "-classpath", "root:dist/ibgroup.web.core.iblink.router.clientportal.gw.jar:build/lib/runtime/*", \
     "ibgroup.web.core.clientportal.gw.GatewayStart"]
