@echo off
echo ============================================
echo   Install IBKR Gateway as Windows Service
echo   (Requires Admin privileges)
echo ============================================
echo.

:: Create a scheduled task that runs at logon
schtasks /create /tn "IBKR Gateway" /tr "cmd /c cd /d C:\Users\z0001tzn\Projects\clientportal.gw && java -Dvertx.disableDnsResolver=true -Djava.net.preferIPv4Stack=true -Dvertx.logger-delegate-factory-class-name=io.vertx.core.logging.SLF4JLogDelegateFactory -Dnologback.statusListenerClass=ch.qos.logback.core.status.OnConsoleStatusListener -Dnolog4j.debug=true -Dnolog4j2.debug=true -classpath root;dist\ibgroup.web.core.iblink.router.clientportal.gw.jar;build\lib\runtime\* ibgroup.web.core.clientportal.gw.GatewayStart" /sc onlogon /rl highest /f

:: Create a scheduled task for cloudflared tunnel
schtasks /create /tn "IBKR Tunnel" /tr "C:\Users\z0001tzn\Projects\cloudflared.exe tunnel --url https://localhost:5000 --no-tls-verify" /sc onlogon /rl highest /f

echo.
echo Services installed. They will start automatically when you log in.
echo To start now, run: start-ibkr-gateway.bat
echo.
pause
