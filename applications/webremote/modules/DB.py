#!/usr/bin/env python
from gluon import *
from tables import define_tables

if 'db' not in globals():
#try:
    db = DAL("sqlite:///home/www-data/web2py/applications/webremote/databases/storage.sqlite",
         migrate_enabled=False,
         fake_migrate=True)
    define_tables(db)
#except: db = None
