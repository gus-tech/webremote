#!/bin/bash

sudo python /home/www-data/web2py/gpio_cleanup.py
sleep 1
sudo init $1
