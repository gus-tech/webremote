#!/bin/bash

sudo killall python
cd /home/www-data/web2py
#sudo  ./applications/webremote/modules/websocket_messaging.py -k mykey -p 8888
sudo  ./applications/webremote/modules/websocket_messaging.py -k mykey -p 8888 -c /etc/ssl/wildcard.gus.tech.crt -s /etc/ssl/wildcard.gus.tech.key
