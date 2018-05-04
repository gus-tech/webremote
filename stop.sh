#!/bin/bash

sudo service apache2 stop
sudo killall python
sudo systemctl daemon-reload

