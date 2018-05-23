// Globals ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
var site_ready = true;
var ws = null
var bt_pressed = 0
var intervals = []
var edit_mode = null
var voice_mode = null
var delete_prompt = null
var current_activity = null
var current_remote = null
var current_map = $("#key_maps")
var current_selection = null
var waiting4key = false
var remote_type_class = {1:'bt', 2:'ir'}
var click_down = 0
var map_x = 0
var map_y = 40
var temp_id = 0
var deleted_button_maps = {}
var display_layout = null
var offset = null

var BT = 1
var IR = 2
var LEARN = 3

var clear_bt = {1:[253,9,1,0,0,0,0,0,0,0,0, 253,5,2,0,0,0,0, 253,3,3,0,0]}

var cursor_speed = 20
var cursor_x = cursor_speed
var cursor_y = cursor_speed
var bt_keys = [0,0,0,0,0,0]
var bt_mods = [0,0,0,0,0,0,0,0]
var bt_keys_doms = []
var bt_mouse = [0,0,0,0]
var bt_mouse_doms = []
var bt_consumer = {}
var keys_pressed = {}


// Setup ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
$(document).ready(function(){

    // WEBSOCKET
    ws_ready()

    // SETTINGS
    setup_trash();
    setup_template_button_click();
    setup_template_button_drag();

    // ACTIVITIES, REMOTES, BUTTONS & MAPS
    for(var i in activities)  display_activity(activities[i]);
    setup_activities_tabs();
    for(var i in remotes)     display_remote(remotes[i]);
    setup_remotes_tabs();
    for(var i in button_maps) display_button_map(button_maps[i]);
    setup_maps_tabs()

    apply_settings();

    // LISTENERS
    $(window).resize(window_resize);
    $(document).on('mousedown touchstart', screen_press);
    $(document).on('mouseup touchend', clear_presses);
    $(document).on('keydown', key_down);
    $(document).on('keyup', key_up);
    setup_voice_control() // Only compatible with Chrome-based Browsers for now
    $('[data-toggle="tooltip"]').tooltip();

    setTimeout(function(){ // Workaround for Chrome (66.0.3359.139)
        document.body.style.display = "inline-block";
        window_resize(); // Needed for jquery outerHeight() to report accurately
        position_button_maps();
    }, 100);

});


function setup_template_button_click(){
    $('.template').click(function(){
        if(display_layout != 'mobile') return false
        if(!edit_mode) toggle_edit_mode();
        if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 2})
        var button = display_button_map({'classes':$(this).attr('class')})
        save_button_map(button)
    });
}


function setup_template_button_drag(){
    $('.template').draggable({
        helper: "clone",
        grid: [GRID_SIZE, GRID_SIZE],
        containment: $('#activities_div'),
        drag: function(e,ui){ align_to_grid($(ui.helper)) },
        start: function(e,ui){ if(!edit_mode) toggle_edit_mode(); $(ui.helper).css("cursor", "move");},
        stop: function(e,ui){
            $(ui.helper).css("cursor", "pointer");
            var data = {}
            data['classes'] = $(ui.helper).attr('class')
            data['x'] = parseInt($(ui.helper).position()['left'] + GRID_SIZE - $('#activities_div').offset().left);
            data['y'] = parseInt($(ui.helper).position()['top'] + GRID_SIZE + 5);
            var button = display_button_map(data);
            save_button_map(button)
        }
    });
}


function setup_trash(){
    $('.trash').droppable({
        accept: ".deleteable",
        drop: delete_object,
        tolerance: "pointer"
    });
}


function setup_voice_control(){
    if(annyang){
        //annyang.debug();
        apply_voice_mode();
        $('.voice_mode').click(toggle_voice_mode);
    }else{
        $('#voice_settings_div').css('display', 'none');
        console.log("WARNING: This browser doesn't support voice control!")
    }
}


function position_button_maps(e, ui){
    if(current_activity){
        display_key_maps(current_activity.attr('activity_id'));
        display_voice_maps(current_activity.attr('activity_id'));
    }
    $('.button_map').each(function(){
        var x = parseInt($(this).attr('x'));
        var y = parseInt($(this).attr('y'));
        var x_actual = parseInt($(this).position()['left']);
        var y_actual = parseInt($(this).position()['top']);
        if(x != x_actual || y != y_actual){
            $(this).css({top: y, left: x, position: 'absolute'});
        }
    });
}

function setup_activities_tabs(){
    if(($('#activities_div').data("ui-tabs"))){ $('#activities_div').tabs('refresh');
    }else{$("#activities_div").tabs({
        beforeActivate: function(e, ui){
            $('*').blur()
            if(ui.newPanel.selector == "#add_activity"){
                e.preventDefault();
                add_activity()
                return false
            }else if(ui.newPanel.selector == "#trash_tab"){
                e.preventDefault();
                return false;
            }else{
                current_activity = $(ui.newPanel.selector)
                display_key_maps(current_activity.attr('activity_id'))
                display_voice_maps(current_activity.attr('activity_id'))
            }
        },
        create: position_button_maps,
        activate: position_button_maps,
    });
    }
    var active = $('#activities_div').tabs("option", "active");
    if(active <= 0) $('#activities_div').tabs({active:1});
}


function setup_remotes_tabs(){
    if($('#remotes_div').data("ui-tabs")){ $('#remotes_div').tabs('refresh');
    }else{$('#remotes_div').tabs({
        beforeActivate: function(e, ui){
            $('*').blur()
            if(ui.newPanel.selector == "#add_remote"){
                e.preventDefault();
                add_remote()
                return false
            }else{
                current_remote = $(ui.newPanel.selector);
                if(current_remote.attr('remote_type') == IR && edit_mode){
                    $('#add_remote_button').css('display', 'block')
                }else{
                    $('#add_remote_button').css('display', 'none')
                }
                window_resize()
            }
        },
    });
    }
    var active = $('#remotes_div').tabs("option", "active");
    if(active <= 0) $('#remotes_div').tabs({active:1});
}


function setup_maps_tabs(){
     $('#maps_div').tabs({
        beforeActivate: function(e, ui){
            $('*').blur()
            if(ui.newPanel.selector == "#trash_tab"){
                e.preventDefault();
                return false;
            }else current_map = $(ui.newPanel.selector)
        },
    });
    var active = $('#maps_div').tabs("option", "active");
    if(active <= 0) $('#maps_div').tabs({active:1});
}


function setup_macros_tabs(){
    $('#macros_div').tabs({
        active:1,
        beforeActivate: function(e, ui){
            $('*').blur()
            if(ui.newPanel.selector == "#add_macro"){
                e.preventDefault();
                add_macro()
                return false
            }else{
                current_macro = $(ui.newPanel.selector)
            }
        },
    });
}


function setup_edit_mode_tab(e, ui){
    if(ui.newPanel.selector == "#edit_mode"){
        e.preventDefault();
        toggle_edit_mode();
        return false;
    }
}


// Web Socket Code ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function ws_ready(){
    if(ws == null){
        var url_scheme = "{{=request.env.wsgi_url_scheme}}"
        if(url_scheme == "http") ws = $.web2py.web2py_websocket("ws://"+window.location.host+":"+WEBSOCKET_PORT+"/realtime/");
        else ws = $.web2py.web2py_websocket("wss://"+window.location.host+":"+WEBSOCKET_PORT+"/realtime/");
        ws.onmessage = ws_onmessage;
        ws.onclose   = ws_reconnect;
    }
    if(ws.readyState != 1) return false;
    else return true;
}

function ws_reconnect(){
    ws = null;
    setTimeout(ws_ready, 1000);
}


function ws_onmessage(e){
    try{var data = JSON.parse(e.data)}
    catch(err){console.log("Error:", err, e.data); return false}
    console.log(data);
    if('message' in data) console.log("MESSAGE: " + data['message']);
    else if('code' in data) display_remote_button(data)
    //else if('add_remote' in data) add_remote_callback(data['add_remote'])
    //else console.log(data);
    else{
        window[Object.keys(data)[0]](data[Object.keys(data)[0]]);
    }
}


// Layout ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function window_resize(){
    if($(window).width() >= LAYOUT_WIDTH){
        var max_height = apply_dekstop_layout();
        display_layout = 'desktop'
    }else{
        var max_height = apply_mobile_layout();
        display_layout = 'mobile'
    }
    var map_padding = 0
    var remote_padding = 0
    if(edit_mode){
        map_padding = $('#add_map_div').height() + PADDING
        if(current_remote.attr('id') != "remote_div1") remote_padding = $('#add_remote_button_div').height() + PADDING
    }
    $('.map_div').css('height', max_height - $('#maps_tabs').outerHeight() - $('#toolbar_tabs').outerHeight() - map_padding - (PADDING*2));
    $('.remote_div').css('height', max_height - $('#remotes_tabs').outerHeight() - remote_padding - (PADDING*2));
    offset = $('#activities_div').offset();
}


function apply_dekstop_layout(){
    if(!$('#toolbar').data("ui-tabs")){
        if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs('destroy');
        $('#primary_tabs').hide()
        $('#remotes_div').show()
        $('#toolbar').show();
        $('#toolbar').append($('#maps_div'))
        $('#toolbar').append($('#settings_div'))
        $('#toolbar_tabs').append($('#edit_check'))
        $('#master').append($('#remotes_div'))
        $('#toolbar').tabs({
            activate: window_resize,
            beforeActivate: setup_edit_mode_tab
        });
    }
    $('.remote_button').removeClass('remote_button_mobile')
    $('.key_map').removeClass('key_map_mobile')
    $('.voice_map').removeClass('voice_map_mobile')
    $('.add_button').removeClass('add_remote_button_mobile')
    setup_template_button_drag();
    $('.template').draggable('enable');
    $('.template').removeClass('template_mobile');
    return $('#primary_div').outerHeight()
}


function apply_mobile_layout(){
    if(!$('#primary_div').data("ui-tabs")){
        if($('#toolbar').data("ui-tabs")) $('#toolbar').tabs('destroy');
        $('#toolbar').hide();
        $('#primary_tabs').show()
        $('#primary_tabs').prepend($('#edit_check'))
        $('#primary_div').append($('#remotes_div'))
        $('#primary_div').append($('#maps_div'))
        $('#primary_div').append($('#settings_div'))
        $('#primary_div').tabs({
            active:1,
            activate: window_resize,
            beforeActivate: setup_edit_mode_tab
        });
    }
    $('.remote_button').addClass('remote_button_mobile');
    $('.key_map').addClass('key_map_mobile');
    $('.voice_map').addClass('voice_map_mobile');
    $('.add_button').addClass('add_remote_button_mobile');
    $('.template').draggable('disable');
    $('.template').addClass('template_mobile');
    return $('#primary_div').outerHeight() - $('#primary_tabs').outerHeight()
}


function align_to_grid(object){
    var top = object.position()['top'];
    var left = object.position()['left'];
    left = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    top = Math.floor(top / GRID_SIZE) * GRID_SIZE;
    object.css({'top':top, 'left':left});
}


// General ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function disable_selected_elements(){
    $('.selected').removeClass('selected');
    current_selection = null;
}


function toggle_select(e){
    if(edit_mode){
        if($(e.currentTarget).hasClass('selected')){
            $('.selected').removeClass('selected');
            current_selection = null;
        }else{
            $('.selected').removeClass('selected');
            $(e.currentTarget).addClass('selected');
            current_selection = $(e.currentTarget);
        }
    }else{
        current_selection = null;
    }
}


function apply_edit_state(){
    if($('.edit_mode').data('checked') == true){
        edit_mode = true;
        $("#favicon").attr("href", "{{=URL('static', 'edit_mode.png')}}");
        $('.edit_mode').removeClass('glyphicon-unchecked');
        $('.edit_mode').addClass('glyphicon-check');
        $('.button_map').removeClass('clickable');
        $('.remote_button').draggable('enable');
        $('.button_map').draggable('enable');
        $('.key_map').draggable('enable');
        $('.voice_map').draggable('enable');
        $('.activity_tab').draggable('enable');
        $('.remote_tab').draggable('enable');
        clear_presses()
        if(current_remote.attr('id') != "remote_div1" ) $('#add_remote_button').slideDown(200);
        $('#add_map_button').slideDown(200);
        $('.trash').slideDown(200, window_resize);
    }else{
        edit_mode = false;
        disable_selected_elements();
        $("#favicon").attr("href", "{{=URL('static', 'images/favicon.png')}}");
        $('.edit_mode').removeClass('glyphicon-check');
        $('.edit_mode').addClass('glyphicon-unchecked');
        $('.button_map').addClass('clickable');
        $('.remote_button').draggable('disable');
        $('.button_map').draggable('disable');
        $('.key_map').draggable('disable');
        $('.voice_map').draggable('disable');
        $('.activity_tab').draggable('disable');
        $('.remote_tab').draggable('disable');
        $('#add_remote_button').slideUp(200);
        $('#add_map_button').slideUp(200);
        $('.trash').slideUp(200, window_resize);
    }
    $('.edit_mode').data('checked', edit_mode);
}

function toggle_edit_mode(){
    if($('.edit_mode').data('checked') == true){
        $('.edit_mode').data('checked', false);
    }else{$('.edit_mode').data('checked', true);}
    apply_edit_state();
}

function apply_voice_mode(){
    if($('.voice_mode').data('checked') == true){
        voice_mode = true;
        $('.voice_mode').removeClass('glyphicon-unchecked');
        $('.voice_mode').addClass('glyphicon-check');
        annyang.start();
    }else{
        voice_mode = false;
        $('.voice_mode').removeClass('glyphicon-check');
        $('.voice_mode').addClass('glyphicon-unchecked');
        annyang.abort();
    }
    $('.voice_mode').data('checked', voice_mode)
    var data = {}
    data['setting'] = "voice_mode"
    data['val'] = voice_mode
    if(ws_ready()) ws.send(JSON.stringify({'save_settings':data}));
}


function toggle_voice_mode(){
    if($('.voice_mode').data('checked') == true){
        $('.voice_mode').data('checked', false);
    }else{$('.voice_mode').data('checked', true);}
    apply_voice_mode();
}


function apply_delete_state(){
    if($('.delete_prompt').data('checked') == true){
        delete_prompt = true
        $('.delete_prompt').removeClass('glyphicon-unchecked')
        $('.delete_prompt').addClass('glyphicon-check')
    }else{
        delete_prompt = false
        $('.delete_prompt').removeClass('glyphicon-check')
        $('.delete_prompt').addClass('glyphicon-unchecked')
    }
    $('.delete_prompt').data('checked', delete_prompt)
    var data = {}
    data['setting'] = "delete_prompt"
    data['val'] = delete_prompt
    if(ws_ready()) ws.send(JSON.stringify({'save_settings':data}));
}


function toggle_delete_prompt(){
    if($('.delete_prompt').data('checked') == true && confirm('Sure you want to disable these deletation warnings?')){
        $('.delete_prompt').data('checked', false);
    }else{ $('.delete_prompt').data('checked', true);}
    apply_delete_state();
}


function apply_settings(){
    $('#edit_check_settings').click(toggle_edit_mode);
    $('#delete_check').click(toggle_delete_prompt);
    apply_delete_state();
    apply_edit_state();
}


function save_settings_callback(data){
    for(var i in data){
        console.log("Setting Saved:", data[i]['setting'], "=", data[i]['val'])
    }
}


function press_button(button, repeat){
    if(edit_mode || !button.attr('button_id')) return false
    send_code(button);
    if(button.attr('remote_type') == BT) bt_pressed = true;
    else if (repeat && button.attr('remote_type') == IR){intervals.push(setInterval(function(){send_code(button);}, 250))}
    return true
}


function press_button_id(button_id, repeat){
    press_button(buttons[button_id]['dom'], repeat);
    clear_presses();
}


function send_code(button){
    var button_id = button.attr('button_id')
    var remote_type = button.attr('remote_type')
    if(ws_ready() && button_id && remote_type){
        data = {}
        try{data[remote_type] = JSON.parse(buttons[button_id]['code'])}
        catch(error){data[remote_type] = buttons[button_id]['code']}
        ws.send(JSON.stringify(data));
        flash_buttons(button_id)
    }
}


function press_buttons(){
    if(ws_ready()){
        data = {}
        // Keyboard
        var keys_length = Object.keys(bt_keys).length
        if(keys_length > 6) keys_length = 6;
        var mods = 0
        for(var i in bt_mods) mods += bt_mods[i];
        var code = [253, keys_length+3, 1, mods, 0]
        var j = 0
        for(var i in bt_keys){
            if(j > 6) break;
            code.push(bt_keys[i])
            j++;
        }
        data[BT] = code
        ws.send(JSON.stringify(data));

        // Mouse
        var code = [253, 5, 2]
        for(var i in bt_mouse){
            code.push(bt_mouse[i])
        }
        data[BT] = code
        ws.send(JSON.stringify(data));
    }
}


// Handle Input ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var start_time, end_time
function key_down(e){
    e.preventDefault();
    add_key_map(e)
    if(!edit_mode) poll_key_map(e)
}


function key_up(e) {
    e.preventDefault();
    if(!edit_mode) poll_key_map_up(e);
    //stop_flash()
    $('*').blur()
}


var click_start, click_end
var click_max = 200


function screen_press(e){
    e.preventDefault();
    click_start = new Date().getTime();
}


function clear_presses(){
    click_end = new Date().getTime();
    if ((click_end - click_start) < click_max) {
        //console.log('< '+click_max);
        //send_code($('#4665'));//press enter
        //bt_pressed = true;
    } else if (click_end - click_start >= click_max) {
        //NOTHING
    }
    if(bt_pressed && ws_ready()){
        ws.send(JSON.stringify(clear_bt));
        bt_pressed = false;
        //console.log("Clearing BT presses");
    }
    //if(intervals.length > 0) console.log("Clearing IR presses");
    for(var i in intervals) clearInterval(intervals[i]);
    intervals = [];
    //stop_flash()
    $('*').blur()
}

function flash_buttons(button_id){
    $('[button_id="'+button_id+'"]').effect('highlight', 150);
}

function stop_flash(){
    setTimeout(function(){
        $('.button_map').finish();
        $('.key_map').finish();
        $('.voice_map').finish();
        $('.remote_button').finish();
    }, 200);
}

function poll_key_map(e){
    //alert(e.key)
    if(e.key == " ") e.key = "Space"
    var key_code = e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();
    var activity_id = current_activity.attr('activity_id')
    if(key_code in key_maps[activity_id]){
        var key_map = key_maps[activity_id][key_code]
        if(key_map['dom']){
            var button_id = $(key_map['dom']).attr('button_id')
            try{
                var code = buttons[key_map['button_id']]['code']
            }catch(err){
                console.log('No code:', err);
                return false
            }
            if(code[2] == 1){
                if(code[3] != 0){
                    if(bt_mods.indexOf(code[3]) < 0){
                        for(var i in bt_mods){
                            if(bt_mods[i] == 0){bt_mods[i] = code[3]; break;}
                        }
                    }
                }else if(bt_keys.indexOf(code[5]) < 0){
                    for(var i in bt_keys){
                        if(bt_keys[i] == 0){bt_keys[i] = code[5]; break;}
                    }
                }
                press_buttons()

            }else if(code[2] == 2){
                if(code[3] != 0) bt_mouse[0] = code[3];
                if(code[4] != 0) bt_mouse[1] = code[4];
                if(code[5] != 0) bt_mouse[2] = code[5];
                if(code[6] != 0) bt_mouse[3] = code[6];
                press_buttons()
                flash_buttons(button_id)
            }else{
                press_button(key_map['dom']);
            }
            flash_buttons(button_id)
        }
    }
}


function poll_key_map_up(e){
    if(e.key == " ") e.key = "Space"
    var key_code = e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();
    var activity_id = current_activity.attr('activity_id')
    if(key_code in key_maps[activity_id]){
        var key_map = key_maps[activity_id][key_code]
        if(key_map['dom']){
            try{
                var code = buttons[key_map['button_id']]['code']
            }catch(err){
                console.log('No code:', err);
                return false
            }
            if(code[2] == 1){
                if(code[3] != 0){
                    if(bt_mods.indexOf(code[3]) >= 0){
                        for(var i in bt_mods){
                            if(bt_mods[i] == code[3]){bt_mods[i] = 0; break;}
                        }
                    }
                }else if(bt_keys.indexOf(code[5]) >= 0){
                    for(var i in bt_keys){
                        if(bt_keys[i] == code[5]){bt_keys[i] = 0; break;}
                    }
                }
                press_buttons()
                //bt_pressed = true;
                //clear_presses()
            }else if(code[2] == 2){
                if(code[3] != 0) bt_mouse[0] = 0;
                if(code[4] != 0){ bt_mouse[1] = 0; cursor_x = cursor_speed;}
                if(code[5] != 0){ bt_mouse[2] = 0; cursor_y = cursor_speed;}
                if(code[6] != 0) bt_mouse[3] = 0;
                press_buttons()
                console.log("X: " + cursor_x + " - Y: " + cursor_y)
            }else{
                clear_presses()
                //press_button(key_map['dom']);
            }
        }
    }
}

function map_button(source, target){
    target.attr('remote_id', source.attr('remote_id'))
    target.attr('button_id', source.attr('button_id'))
    target.attr('name', source.attr('name'))
    target.attr('remote_type', source.attr('remote_type'))
    target.html('<div class="button_label">'+source.attr('name')+'</div>')
    disable_selected_elements()
    save_button_map(target)
}


function map_key(source, target){
    try{
        var activity_id = current_activity.attr('activity_id')
        target.attr('remote_id', source.attr('remote_id'))
        target.attr('button_id', source.attr('button_id'))
        target.attr('name', source.attr('name'))
        target.attr('remote_type', source.attr('remote_type'))
        key_maps[activity_id][target.attr('key_code')]['remote_id'] = source.attr('remote_id')
        key_maps[activity_id][target.attr('key_code')]['button_id'] = source.attr('button_id')
        key_maps[activity_id][target.attr('key_code')]['remote_type'] = source.attr('remote_type')
        key_maps[activity_id][target.attr('key_code')]['activity_id'] = activity_id
        target.html('Key: '+target.attr('key_code')+'<br>'+remotes[source.attr('remote_id')]['name']+': '+ source.attr('name'))
        save_key_map(target)
    }catch(err){
        console.log('Error in map_key:', err)
        return false
    }
}


function map_voice(source, target){
    var activity_id = current_activity.attr('activity_id')
    target.attr('remote_id', source.attr('remote_id'))
    target.attr('button_id', source.attr('button_id'))
    target.attr('remote_type', source.attr('remote_type'))
    var name = target.attr('name');
    voice_maps[activity_id][target.attr('map_id')]['remote_id'] = source.attr('remote_id')
    voice_maps[activity_id][target.attr('map_id')]['button_id'] = source.attr('button_id')
    voice_maps[activity_id][target.attr('map_id')]['remote_type'] = source.attr('remote_type')
    voice_maps[activity_id][target.attr('map_id')]['activity_id'] = activity_id
    target.html("")
    target.append('<div tamapex="-1">Voice: '+name+'</div>')
    target.append('<div tamapex="-1">'+remotes[source.attr('remote_id')]['name']+': '+buttons[source.attr('button_id')]['name']+'</div>')
    save_voice_map(target)
}

// Display ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function start_drag_deleteable(e, ui){
    $('.add').html('<span class="glyphicon glyphicon-trash"></span>');
    $('.add').css('background-color', '#496687');
    $('.add').css('color', 'white');
    $(ui.helper).css("cursor", "move");
}

function stop_drag_deleteable(e, ui){
    $('.add').html('<span class="glyphicon glyphicon-plus"></span>');
    $('.add').css('background-color', '#A4B1C0');
    $('.add').css('color', 'white');
    $(ui.helper).css("cursor", "pointer");
}

function display_activity(activity){
    if(!(activity['id'] in activities)) activities[activity['id']] = activity
    $('#activities_tab').append('<li><a id="activity_tab'+activity['id']+'" activity_id="'+activity['id']+'" class="activity_tab deleteable" href="#activity_div'+activity['id']+'">'+activity['name']+'</a></li>');
    $('#activities_div').append('<div id="activity_div'+activity['id']+'"></div>');
    var activity_div = $('#activity_div'+activity['id'])
    activity_div.attr('activity_id', activity['id'])
    activity_div.addClass('activity_div')
    activity_div.css('padding', 0)
    $('.activity_tab').draggable({
        helper: "clone",
        start: start_drag_deleteable,
        stop: stop_drag_deleteable
    });
    if(!edit_mode) $('.activity_tab').draggable('disable');
    if(current_activity == null) current_activity = $('#activity_tab' + Object.keys(activity)[0])
}


function display_remote(remote){
    if(!(remote['id'] in remotes)) remotes[remote['id']] = remote
    $('#remotes_tabs').append('<li><a id="remote_tab'+remote['id']+'" href="#remote_div'+remote['id']+'">'+remote['name']+'</a></li>')
    var remotes_tab = $('#remote_tab'+remote['id'])
    remotes_tab.attr('remote_id', remote['id'])
    remotes_tab.attr('remote_type', remote['remote_type'])
    $('#remotes_div').append('<div id="remote_div'+remote['id']+'"></div>')
    var remote_div = $('#remote_div'+remote['id'])
    remote_div.attr('remote_id', remote['id'])
    remote_div.attr('remote_type', remote['remote_type'])
    remote_div.addClass('remote_div')
    remote_div.css('padding-top', 0)
    remote_div.css('padding-bottom', 0)

    if(remote['remote_type'] != BT){
        remotes_tab.addClass('remote_tab').addClass('deleteable')
        remotes_tab.draggable({
            helper: "clone",
            start: start_drag_deleteable,
            stop: stop_drag_deleteable
        });
        if(!edit_mode) remotes_tab.draggable('disable');
    }
    if(!edit_mode) $('#add_remote_button').hide();

    for(var button_id in buttons){
        if(buttons[button_id]['remote_id'] == remote['id']){
            display_remote_button(buttons[button_id])
        }
    }
}


function display_remote_button(button){
    if(button['id'] == undefined) return false
    if(!(button['id'] in buttons)) buttons[button['id']] = button
    buttons[button['id']]['remote_type'] = remotes[button['remote_id']]['remote_type']
    if($('#'+button['id'])[0]) return false
    $('#remote_div'+button['remote_id']).append('<div id="'+button['id']+'">'+button['name']+'</div>')
    var temp_button = $('#'+button['id'])
    //console.log($('#remote_div'+button['remote_id']))
    //console.log(temp_button)
    temp_button.attr('button_id', button['id'])
    temp_button.attr('remote_id', button['remote_id'])
    temp_button.attr('name', button['name'])
    temp_button.attr('remote_type', remotes[button['remote_id']]['remote_type'])
    temp_button.addClass('remote_button').addClass('deleteable')
    if(display_layout == 'mobile') temp_button.addClass('remote_button_mobile')
    temp_button.attr('tamapex', -1)
    buttons[button['id']]['dom'] = temp_button
    temp_button.on('mousedown touchstart',function(e){
        if(current_selection && current_selection.hasClass('button_map')){
            map_button($(this), current_selection)
            if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        }else if(current_selection && current_selection.hasClass('key_map')){
            map_key($(this), current_selection)
            if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        }else if(current_selection && current_selection.hasClass('voice_map')){
            map_voice($(this), current_selection)
            if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        }else{
            press_button($(this))
        }
    });
    temp_button.draggable({
        helper: "clone",
        revert: false,
        start: start_drag_deleteable,
        stop: stop_drag_deleteable
    });
    return temp_button
}


function display_button_map(button){
    if('id' in button) var map_id = button['id'];
    else var map_id = "temp"+temp_id++
    var html = '<div id="button_map'+map_id+'"></div>';
    if('activity_id' in button && button['activity_id'] in activities) var activity_id = button['activity_id']
    else var activity_id = current_activity.attr('activity_id')
    var new_button = false
    if(!$('#button_map'+map_id)[0]){
        $('#activity_div'+activity_id).append(html)
        new_button = true
    }
    var temp_button = $('#button_map'+map_id)

    temp_button.text()
    temp_button.css({position: 'absolute'});
    if('x' in button && 'y' in button){
        temp_button.css({top: button['y'], left: button['x'], position: 'absolute'});
        temp_button.attr('x', button['x']);
        temp_button.attr('y', button['y']);
    }
    else{
        map_x += 40
        map_y += 40
        if(map_x >= $('#activities_div').width()-100) map_x = 0;
        if(map_y >= $('#activities_div').height()-100) map_y = 40;
        temp_button.css({top: map_y, left: map_x, position: 'absolute'});
    }
    align_to_grid(temp_button)
    if(!(map_id in button_maps)) button_maps[map_id] = {}
    button_maps[map_id]['dom'] = temp_button
    button_maps[map_id]['interval'] = null
    temp_button.attr('activity_id', activity_id)
    if('button_id' in button && button['button_id'] in buttons){
        temp_button.attr('button_id', button['button_id'])
        temp_button.attr('remote_id', button['remote_id'])
        temp_button.attr('remote_type', remotes[button['remote_id']]['remote_type'])
        temp_button.html('<div class="button_label">'+buttons[button['button_id']]['name']+'</div>')
    }
    temp_button.attr('class', $(this).attr('class'))
    if('classes' in button) temp_button.attr('class', button['classes'])
    temp_button.addClass('deleteable').addClass('button_map')
    temp_button.removeClass('clickable').removeClass('template').removeClass('selected')
    temp_button.draggable({
        grid: [GRID_SIZE, GRID_SIZE],
        containment: $('#activities_div'),
        drag: function(e, ui){align_to_grid($(this))},
        start: start_drag_deleteable,
        stop: function(e, ui){
            stop_drag_deleteable(e, ui);
            save_button_map($(this));
        },
    });

    if(new_button){
        temp_button.on('mousedown touchstart', function(e){if(!edit_mode) press_button($(this), true)});
        temp_button.click(function(e){toggle_select(e)});
    }
    // Select new buttons and already selected buttons
    if(temp_button.attr('id').indexOf('temp') >= 0 || button['selected']){
        temp_button.draggable('disable');
        var event = {}
        event.currentTarget = temp_button
        toggle_select(event)
    }
    temp_button.droppable({
        accept: ".remote_button",
        drop: function(e,ui){map_button($(ui.helper), $(e.target))}
    });
    return temp_button
}


function display_key_maps(activity_id){
    $('#key_maps').html("")
    for(var key_code in key_maps[activity_id]){
        var id = key_maps[activity_id][key_code]['id']
        var button_id = key_maps[activity_id][key_code]['button_id']
        $('#key_maps').append('<li id="k'+id+'"tamapex="-1">Key: '+key_code+'<br>'+remotes[key_maps[activity_id][key_code]['remote_id']]['name']+': '+buttons[button_id]['name']+'</li>')
        $('#key_maps').css('padding-top', 0)
        $('#key_maps').css('padding-bottom', 0)
        var key_map = $('#k'+id)
        key_maps[activity_id][key_code]['dom'] = key_map
        key_map.attr('button_id', button_id)
        key_map.attr('remote_id', key_maps[activity_id][key_code]['remote_id'])
        key_map.attr('activity_id', activity_id)
        key_map.attr('remote_type', buttons[button_id]['remote_type'])
        key_map.attr('key_code', key_code)
        key_map.addClass('key_map').addClass('deleteable')
        key_map.click(function(e){toggle_select(e)});
    }
    $('.key_map').draggable({
        helper: "clone",
        start: start_drag_deleteable,
        stop: stop_drag_deleteable
    });
    if(!edit_mode) $('.key_map').draggable('disable');
    $('.key_map').droppable({
        accept: ".remote_button",
        drop: function(e,ui){map_key($(ui.helper), $(e.target))}
    });
}
/*
function display_macros(activity_id){
    $('#activity_macros').html("")
    for(var macro in macros[activity_id]){
        var id = macros[activity_id][macro]['id']
        //var button_id = macros[activity_id][macro]['button_id']
        $('#activity_macros').append('<li id="k'+id+'"tamapex="-1">Key: '+key_code+'<br>'+remotes[key_maps[activity_id][key_code]['remote_id']]['name']+': '+buttons[button_id]['name']+'</li>')
        var key_map = $('#k'+id)
        key_maps[activity_id][key_code]['dom'] = key_map
        key_map.attr('button_id', button_id)
        key_map.attr('remote_id', key_maps[activity_id][key_code]['remote_id'])
        key_map.attr('activity_id', activity_id)
        key_map.attr('remote_type', buttons[button_id]['remote_type'])
        key_map.attr('key_code', key_code)
        key_map.addClass('key_map').addClass('deleteable')
        key_map.click(function(e){toggle_select(e)});
    }
    $('.key_map').draggable({
        helper: "clone",
    });
    if(!edit_mode) $('.key_map').draggable('disable');
    $('.key_map').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            map_key($(ui.helper), $(e.target))
        }
    });
}
*/
function display_voice_maps(activity_id){
    if(annyang) annyang.removeCommands();
    var commands = {};
    $('#voice_maps').html("");
    for(var i in voice_maps[activity_id]){
        var id = voice_maps[activity_id][i]['id'];
        var button_id = voice_maps[activity_id][i]['button_id'];
        var remote_id = voice_maps[activity_id][i]['remote_id'];
        var name = voice_maps[activity_id][i]['name'];
        $('#voice_maps').append('<div id="voice_map'+id+'" tamapex="-1"></div>');
        $('#voice_maps').css('padding-top', 0);
        $('#voice_maps').css('padding-bottom', 0);
        var voice_map = $('#voice_map'+id);
        voice_map.append('<div tamapex="-1">Voice: '+name+'</div>');
        voice_map.append('<div tamapex="-1">'+remotes[remote_id]['name']+': '+buttons[button_id]['name']+'</div>');
        voice_maps[activity_id][i]['dom'] = voice_map;
        voice_map.attr('name', name);
        voice_map.attr('map_id', id);
        voice_map.attr('button_id', button_id);
        voice_map.attr('remote_id', remote_id);
        voice_map.attr('activity_id', activity_id);
        voice_map.attr('remote_type', buttons[button_id]['remote_type']);
        voice_map.addClass('voice_map').addClass('deleteable');
        voice_map.click(function(e){toggle_select(e)});
        commands[name] = new Function('press_button($("#'+voice_map.attr('id')+'")); clear_presses();');
    }
    if(annyang) annyang.addCommands(commands);
    $('.voice_map').draggable({
        helper: "clone",
        start: start_drag_deleteable,
        stop: stop_drag_deleteable
    });
    if(!edit_mode) $('.voice_map').draggable('disable');
    $('.voice_map').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            map_voice($(ui.helper), $(e.target))
        }
    });
}

// Add ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function add_activity(){
    if(ws_ready()){
        var name = prompt("Enter new activity name"); if(name === null) return false;
        name = name.trim(); if(name == "") return false;
        console.log("Adding activity: "+name)
        data = {'add_activity': {'name':name}}
        ws.send(JSON.stringify(data));
    }
}

function add_activity_callback(dict){
    var activity = dict['activity']
    var temp_key_maps = dict['key_maps']
    var id = activity['id']
    if($('#activity_tab'+id)[0]) return false
    key_maps[id] = {}
    for(var i in temp_key_maps[id]){
        key_maps[id][i] = temp_key_maps[id][i];
    }
    console.log("Added activity: "+id)
    activities[id] = activity
    display_activity(activities[id])
    setup_activities_tabs();
}


function add_remote(){
    if(ws_ready()){
        var name = prompt("Enter new remote name"); if(name === null) return false;
        name = name.trim(); if(name == "") return false;
        console.log("Adding remote: "+name)
        data = {'add_remote': {'name':name, 'remote_type':IR, 'device_id':2}}
        ws.send(JSON.stringify(data));
    }
}

function add_remote_callback(remote_dict){
    var id = remote_dict['id']
    if($('#remote_tab'+id)[0]) return false
    console.log("Added remote: "+id)
    remotes[id] = remote_dict
    remotes[id]['buttons'] = {}
    console.log(remotes[id])
    display_remote(remotes[id])
    setup_remotes_tabs();
}


function add_remote_button(){
    if(ws_ready()){
        var name = prompt("Enter a name for the new button"); if(name === null) return false;
        name = name.trim(); if(name == "") return false;
        data = {}
        data[LEARN] = {}
        data[LEARN]['name'] = name
        data[LEARN]['remote_id'] = current_remote.attr('remote_id');
        ws.send(JSON.stringify(data));
    }
}

function add_remote_button_callback(data){
    console.log(data)
}

function add_map(){
    if(current_map && current_map.attr('id') == "key_maps"){waiting4key = true; console.log('waiting4key: '+waiting4key)}
    else if(current_map && current_map.attr('id') == "voice_maps") add_voice_map();
}


function add_key_map(e){
    if(!waiting4key) return false
    if(e.key == " ") e.key = "Space"
    var key_code = e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();
    var activity_id = current_activity.attr('activity_id')
    if(!(key_code in key_maps[activity_id])){
        var id = "tempk"+temp_id++
        $('#key_maps').append('<li id="'+id+'" class="key_map deleteable" key_code="'+key_code+'">'+key_code+' - UNASSIGNED</li>')
        var key_map = $('#'+id)
        key_map.attr('activity_id', activity_id)
        key_map.click(function(e){toggle_select(e)});
        $('.key_map').draggable({
            helper: "clone",
            start: start_drag_deleteable,
            stop: stop_drag_deleteable
        });
        if(!edit_mode) $('.key_map').draggable('disable');
        $('.key_map').droppable({
            accept: ".remote_button",
            drop: function(e,ui){
                map_key($(ui.helper), $(e.target))
            }
        });
        $('#key_maps')[0].scrollTop = $('#key_maps')[0].scrollHeight;
        key_maps[activity_id][key_code] = {}
        key_maps[activity_id][key_code]['id'] = id
        key_maps[activity_id][key_code]['dom'] = key_map
        key_maps[activity_id][key_code]['activity_id'] = activity_id
    }
    waiting4key = false
}



function add_voice_map(){
    var name = prompt("Enter new voice map"); if(name === null) return false;
    name = name.trim(); if(name == "") return false;
    console.log("Adding voice map: "+name)
    var activity_id = current_activity.attr('activity_id')
    var id = "temp"+temp_id++
    $('#voice_maps').append('<div id="voice_map'+id+'" tamapex="-1"></div>')
    var voice_map = $('#voice_map'+id)
    voice_map.append('<div tamapex="-1">Voice: '+name+'</div>')
    //voice_map.append('<div tamapex="-1">'+remotes[remote_id]['name']+': '+buttons[button_id]['name']+'</div>')
    voice_maps[activity_id][id] = {}
    voice_maps[activity_id][id]['dom'] = voice_map
    voice_map.attr('map_id', id)
    voice_map.attr('name', name)
    voice_map.attr('activity_id', activity_id)
    voice_map.addClass('voice_map').addClass('deleteable')
    voice_map.click(function(e){toggle_select(e)});
    $('.voice_map').draggable({
        helper: "clone",
        start: start_drag_deleteable,
        stop: stop_drag_deleteable
    });
    if(!edit_mode) $('.voice_map').draggable('disable');
    $('.voice_map').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            map_voice($(ui.helper), $(e.target))
        }
    });
    $('#voice_maps')[0].scrollTop = $('#voice_maps')[0].scrollHeight;
    voice_maps[activity_id][id] = {}
    voice_maps[activity_id][id]['id'] = id
    voice_maps[activity_id][id]['dom'] = voice_map
    voice_maps[activity_id][id]['activity_id'] = activity_id
}


// Save ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function save_button_map(button){
    console.log("Saving button map...")
    var data = {}
    var id = button.attr('id')
    data['id'] = id.replace('button_map', '')
    data['remote_id'] = button.attr('remote_id')
    data['button_id'] = button.attr('button_id')
    data['activity_id'] = button.attr('activity_id')
    data['classes'] = button.attr('class')
    data['x'] = parseInt(button.position()['left'])
    data['y'] = parseInt(button.position()['top'])
    ws.send(JSON.stringify({'save_button_map':data}));
}


function save_button_map_callback(button_map){
    if('temp_id' in button_map){
        var temp_id = button_map['temp_id']
        var id = button_map['id']
        $('#button_map'+temp_id).attr('id', "button_map"+id)
        button_map['selected'] = $('#button_map'+id).hasClass('selected')
        display_button_map(button_map)
        apply_edit_state();
    }else{
        for(var i in button_map){
            var id = button_map[i]['id'];
            if(id in deleted_button_maps == false){
                button_map[i]['selected'] = $('#button_map'+id).hasClass('selected')
                display_button_map(button_map[i])
                apply_edit_state();
            }
        }
    }
}


function save_key_map(button){
    console.log("Saving key map...")
    var data = {}
    data['remote_id'] = button.attr('remote_id')
    data['button_id'] = button.attr('button_id')
    data['activity_id'] = button.attr('activity_id')
    data['key_code'] = button.attr('key_code')
    ws.send(JSON.stringify({'save_key_map':data}));
}


function save_key_map_callback(button){
    var id = button['id'];
    var key_code = button['key_code'];
    console.log("Saved!")
    $("li[key_code='"+key_code+"']").attr('id', 'k'+id)
}


function save_voice_map(button){
    button.addClass('save_voice_map')
    console.log("Saving voice map...")
    console.log(button)
    var data = {}
    var id = button.attr('id')
    if(id && id.indexOf("temp") < 0) data['id'] = id.replace('voice_map', '')
    data['remote_id'] = button.attr('remote_id')
    data['button_id'] = button.attr('button_id')
    data['activity_id'] = button.attr('activity_id')
    data['name'] = button.attr('name')
    ws.send(JSON.stringify({'save_voice_map':data}));
}

function save_voice_map_callback(map){
    var id = map['id']
    console.log("Voice map saved!")
    if(id) $('.save_voice_map').attr('id', "voice_map"+id)
    var commands = {}
    commands[map['name']] = new Function('press_button($("#voice_map'+id+'")); clear_presses();')
    if(annyang) annyang.addCommands(commands);
    $('#voice_map'+id).removeClass('save_voice_map')
}

// DELETE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function delete_object(e,ui){
    var object = $(ui.helper.context)
    if(object.hasClass("activity_tab")) delete_activity(object);
    else if(object.hasClass("remote_tab")) delete_remote(object);
    else if(object.hasClass("remote_button")) delete_remote_button(object);
    else if(object.hasClass("button_map")) delete_button_map(object);
    else if(object.hasClass("key_map")) delete_key_map(object);
    else if(object.hasClass("voice_map")) delete_voice_map(object);
}


function delete_activity(activity){
    if(delete_prompt){if(!confirm('Are you sure you want to delete this activity?')) return false;}
    var id = activity.attr('activity_id');
    console.log("Deleting activity:", id);
    ws.send(JSON.stringify({'delete_activity':id}));
}

function delete_activity_callback(id){
    $('#activity_tab'+id).effect('explode',{pieces: 20}, 500);
    $('#activity_div'+id).effect('explode',{pieces: 20}, 500);
    setup_activities_tabs();
    console.log("Deleted activity:", id)
}


function delete_remote(remote){
    var id = remote.attr('remote_id')
    var name = remote.attr('name')
    if(delete_prompt){if(!confirm('Are you sure you want to delete this remote?\n'+name)) return false;}
    console.log("Deleting remote: "+id)
    console.log("Deleting remote: "+name)
    ws.send(JSON.stringify({'delete_remote':id}));
}


function delete_remote_callback(id){
    console.log(id)
    for(var i in button_maps){
        if(button_maps[i]['dom'].attr('remote_id') == id){
            button_maps[i]['dom'].html("")
            button_maps[i]['dom'].attr('remote_id', null)
            button_maps[i]['dom'].attr('button_id', null)
        }
    }
    for(var i in key_maps){
        for(var j in key_maps[i]){
            if(key_maps[i][j]['remote_id'] == id){
                delete key_maps[i][j]
            }
        }
    }
    $('.key_map').each(function(){
        if($(this).attr('remote_id') == id){
            $(this).effect('explode',{pieces: 20}, 500)
        }
    });
    delete remotes[id]
    $('#remote_tab'+id).effect('explode',{pieces: 20}, 500)
    $('#remote_div'+id).effect('explode',{pieces: 20}, 500)
    setup_remotes_tabs();

    window_resize();
    console.log("Deleted remote!")
}


function delete_remote_button(button){
    var id = button.attr('button_id')
    var name = button.attr('name')
    if(delete_prompt){if(!confirm('Are you sure you want to delete this button?\n\n'+name)) return false;}
    console.log("Deleting button: "+name)
    ws.send(JSON.stringify({'delete_remote_button':id}));
}


function delete_remote_button_callback(id){
    //Delete the buttons
    for(var i in button_maps){
        if(button_maps[i]['dom'].attr('button_id') == id){
            button_maps[i]['dom'].html("")
            button_maps[i]['dom'].attr('remote_id', null)
            button_maps[i]['dom'].attr('button_id', null)
            delete button_maps[i]
        }
    }
    for(var i in key_maps){
        for(var j in key_maps[i]){
            if(key_maps[i][j]['button_id'] == id){
                delete key_maps[i][j]
            }
        }
    }
    $('.key_map').each(function(){
        if($(this).attr('button_id') == id){
            $(this).effect('explode',{pieces: 20}, 500)
        }
    });
    delete buttons[id]
    $('#'+id).effect('explode',{pieces: 20}, 500)
    console.log("Deleted button: "+id)

}


function delete_button_map(button_map){
    var id = button_map.attr('id').replace("button_map", "")
    var name = button_map.attr('name')
    if(delete_prompt){if(!confirm('Are you sure you want to delete this button map?\n\n'+name)) return false;}
    console.log("Deleting button map: "+name)
    ws.send(JSON.stringify({'delete_button_map':id}));
}

function delete_button_map_callback(id){
    if(id in deleted_button_maps) return false
    deleted_button_maps[id] = id
    delete button_maps[id]
    $('#button_map'+id).effect('explode',{pieces: 20}, 500)
    console.log("Deleted button map!")
}


function delete_key_map(key_map){
    var id = key_map.attr('id')
    var key_code = key_map.attr('key_code')
    if(delete_prompt){ if(!confirm('Are you sure you want to delete this key map?\n\n'+key_code)) return false;}
    console.log("Deleting key map: "+key_code)
    ws.send(JSON.stringify({'delete_key_map':id}));
}


function delete_key_map_callback(dict){
    try{
        var id = 'k'+dict['id']
        var activity_id = dict['activity_id']
        var key_code = dict['key_code']
        delete key_maps[activity_id][key_code]
    }catch(err){
        var id = dict
    }
    $('#'+id).effect('explode',{pieces: 20}, 500)
    console.log("Deleted key map!")
}


function delete_voice_map(voice_map){
    var id = voice_map.attr('id').replace('voice_map', '');
    var name = voice_map.attr('name');
    if(delete_prompt){if(!confirm('Are you sure you want to delete this voice map?\n\n'+name)) return false;}
    console.log("Deleting voice map: "+name);
    ws.send(JSON.stringify({'delete_voice_map':id}));
}


function delete_voice_map_callback(dict){
    try{
        var id = dict['id'];
        delete voice_maps[dict['activity_id']][dict['id']];
        if(annyang) annyang.removeCommands(dict['name']);
    }catch(err){
        var id = dict;
    }
    $('#voice_map'+id).effect('explode',{pieces: 20}, 500);
    console.log("Deleted voice map!");
}

function dom2dict(dom){
    var dict = {}
    for (var i = 0; i < dom.attributes.length; i++) {
        var attr = dom.attributes[i];
        if (attr.specified) dict[attr.name] = attr.value;
    }
    return dict
}
