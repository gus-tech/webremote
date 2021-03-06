#!/usr/bin/env python

import traceback
import json
import subprocess


def add_activity(db, activity_dict):
    db.activities[0] = activity_dict
    db.commit()
    activity = db(db.activities).select().last().as_dict()
    default_key_to_button = db(db.default_key_to_button).select()
    for row in default_key_to_button:
        db.key_binds[0] = dict(key_code = row.key_code,
                                     remote_id = row.remote_id,
                                     button_id = row.button_id,
                                     activity_id = activity['id'])
    temp_key_maps = db(db.key_binds.activity_id == activity['id']).select().as_dict()
    key_maps = {}
    for map_key, map in temp_key_maps.iteritems():
        key_maps[activity['id']] = {}
        key_maps[activity['id']][map['key_code']] = map
    return dict(activity=activity, key_maps=key_maps)


def delete_activity(db, activity_id):
    db(db.activities.id == activity_id).delete()
    db(db.button_binds.activity_id == activity_id).delete()
    db(db.key_binds.activity_id == activity_id).delete()
    db.commit()
    return activity_id


def add_remote(db, remote_dict):
    db.remotes[0] = remote_dict
    db.commit()
    return db(db.remotes).select().last().as_dict()


def delete_remote(db, remote_id):
    del db.remotes[remote_id]
    db(db.remote_buttons.remote_id == remote_id).delete()
    db(db.button_binds.remote_id == remote_id).update(**dict(remote_id=None, button_id=None))
    db(db.key_binds.remote_id == remote_id).delete()
    db.commit()
    return remote_id


def add_remote_button(db, button_dict):
    db.remote_buttons[0] = button_dict
    db.commit()
    return db(db.remote_buttons).select().last().as_dict()


def delete_remote_button(db, button_id):
    del db.remote_buttons[button_id]
    db(db.button_binds.button_id == button_id).update(**dict(remote_id=None, button_id=None))
    db(db.key_binds.button_id == button_id).delete()
    db.commit()
    return button_id


def delete_button_map(db, id):
    try:
        del db.button_binds[id]
        db.commit()
    except Exception as e: print('Error:', e)
    return id


def save_button_map(db, button_dict):
    id = button_dict.pop('id')
    if 'temp' in id:
        db.button_binds[0] = button_dict
        db.commit()
        temp_dict = db(db.button_binds).select().last().as_dict()
        temp_dict['temp_id'] = id
        return temp_dict
    else:
        db(db.button_binds.id == int(id)).update(**button_dict)
        db.commit()
        return db(db.button_binds.id == int(id)).select().as_dict()


def delete_key_map(db, map_id):
    try:
        id = map_id.replace('k', '')
        map_dict = db(db.key_binds.id == id).select().last().as_dict()
        db(db.key_binds.id == id).delete()
        db.commit()
        if map_dict != None: return map_dict
    except Exception as e: print('Error:', e)
    return map_id


def save_key_map(db, map_dict):
    db.key_binds.update_or_insert((db.key_binds.key_code == map_dict['key_code']) & (db.key_binds.activity_id == map_dict['activity_id']), **map_dict)
    db.commit()
    return db(db.key_binds).select().last().as_dict()


def delete_voice_map(db, map_id):
    try:
        id = map_id.replace('voice_map', '')
        map_dict = db(db.voice_binds.id == id).select().last().as_dict()
        db(db.voice_binds.id == id).delete()
        db.commit()
        if map_dict != None: return map_dict
    except Exception as e: print('Error:', e)
    return map_id


def save_voice_map(db, map_dict):
    id = map_dict.pop('id', None)
    if id == None:
        db.voice_binds[0] = map_dict
        db.commit()
        return db(db.voice_binds).select().last().as_dict()
    else:
        db(db.voice_binds.id == int(id)).update(**map_dict)
        db.commit()
        return map_dict


def save_settings(db, settings_dict):
    db(db.settings.setting == settings_dict['setting']).update(val=json.dumps(settings_dict['val']) )
    db.commit()
    return db(db.settings.setting == settings_dict['setting']).select().as_dict()

def call_subprocess(db, cmd, shell=True):
    subprocess.call(cmd, shell=shell)

def get_tables(db):
    # SETTINGS
    settings = {}
    temp_settings = db(db.settings).select().as_dict()
    for key, setting in temp_settings.iteritems():
        settings[setting['setting']] = setting['val']

    # REMOTES & BUTTONS
    remotes = db(db.remotes).select().as_dict()
    buttons = db(db.remote_buttons).select().as_dict()
    for key, button in buttons.iteritems():
        button['code'] = json.loads(button['code'])
    activities = db(db.activities).select().as_dict()
    button_maps = db(db.button_binds).select().as_dict()

    # MAPS
    key_maps = {}
    voice_maps = {}
    temp_key_maps = db(db.key_binds).select().as_dict()
    temp_voice_maps = db(db.voice_binds).select().as_dict()
    for activity_id, activity in activities.iteritems():
        key_maps[activity_id] = {}
        voice_maps[activity_id] = {}
        for map_id, map in temp_key_maps.iteritems():
            if map['activity_id'] == activity_id:
                key_maps[activity_id][map['key_code']] = map
        for map_id, map in temp_voice_maps.iteritems():
            if map['activity_id'] == activity_id:
                voice_maps[activity_id][map['id']] = map

    return dict(settings=settings,
                remotes=remotes,
                buttons=buttons,
                button_maps=button_maps,
                key_maps=key_maps,
                voice_maps=voice_maps,
                activities=activities)
