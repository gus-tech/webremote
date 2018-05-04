#!/bin/bash

sudo killall python
sudo systemctl daemon-reload
sudo service apache2 restart
sudo -u www-data  applications/webremote/modules/websocket_messaging.py  -k mykey -p 8888

