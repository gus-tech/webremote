// Globals ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
var ws = null
var bt_pressed = 0
var intervals = []
var edit_mode = false
var del_prompt = true
var current_activity = null
var current_remote = null
var current_bind = $("#key_binds")
var current_selection = null
var waiting4key = false
var remote_type_class = {1:'bt', 2:'ir'}
var click_down = 0
var bind_x = 0
var bind_y = 40
var temp_id = 0

var BT = 1
var IR = 2
//var clear_bt = {1:[0xFD, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
//                   0xFD, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
//                   0xFD, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]}

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
    ws_ready()
    for(var i in activities) display_activity(activities[i]);
    for(var i in remotes) display_remote(remotes[i]);
    $('#activities_div').children().show()
    for(var i in button_binds) display_button_bind(button_binds[i]);
    if(current_activity){
        display_key_binds(current_activity.attr('activity_id'));
        display_voice_binds(current_activity.attr('activity_id'));
    }
    $('#activities_div').children().not('#activities_tab').hide()
    $('#activities_div').tabs({active:1})
    $('#remotes_div').tabs({active:1})
    $('#binds_div').tabs({
        active:1,
        beforeActivate: function(e, ui){
            $('*').blur()
            if(ui.newPanel.selector == "#add_bind"){
                e.preventDefault();
                add_bind()
                return false
            }else{
                current_bind = $(ui.newPanel.selector)
            }
        },
    });

    $('#macros_div').tabs({
        active:1,
        beforeActivate: function(e, ui){
            $('*').blur()
            if(ui.newPanel.selector == "#add_macro"){
                e.preventDefault();
                add_macro()
                return false
            }else{
                //current_macro = $(ui.newPanel.selector)
            }
        },
    });

    toggle_edit_mode();
    window_resize();
    // Bindings
    $(window).resize(window_resize);
    $(document).on('mousedown', screen_press)
    $(document).on('mouseup', clear_presses)
    $(document).on('keydown', key_down)
    $(document).on('keyup', key_up)
    $('.template').click(function(){
        if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        var button = display_button_bind({'classes':$(this).attr('class')})
        save_button_bind(button)
    });
    $('.trash').droppable({
        accept: ".deleteable",
        drop: delete_object,
        tolerance: "pointer"
    });

    if (annyang) {
        annyang.debug();
        annyang.start();
    }

    $('[data-toggle="tooltip"]').tooltip();
    

});


// Web Socket Code ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function ws_ready(){
    if(ws == null || ws.readyState != 1){
        var url_scheme = "{{=request.env.wsgi_url_scheme}}"
        if(url_scheme == "http") ws = $.web2py.web2py_websocket("ws://"+window.location.host+":"+WEBSOCKET_PORT+"/realtime/");
        else ws = $.web2py.web2py_websocket("wss://"+window.location.host+":"+WEBSOCKET_PORT+"/realtime/");
        ws.onmessage = on_message;
        return false
    } else return true
}


function on_message(e){
    try{data = JSON.parse(e.data)}
    catch(err){console.log(e.data); return false}
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
    if($(window).width() >= LAYOUT_WIDTH) var max_height = apply_dekstop_layout();
    else var max_height = apply_mobile_layout();
    $('.bind_div').css('height', max_height - $('#binds_tabs').outerHeight() - $('#toolbar_tabs').outerHeight() - PADDING);
    $('.remote_div').css('height', max_height - $('#remotes_tabs').outerHeight() - PADDING);
}


function apply_dekstop_layout(){
    if(!$('#toolbar').data("ui-tabs")){
        if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs('destroy');
        $('#primary_tabs').hide()
        $('#remotes_div').show()
        $('#toolbar').show();
        $('#toolbar').append($('#binds_div'))
        $('#toolbar').append($('#settings_div'))
        $('#toolbar_tabs').append($('#edit_check'))
        $('#master').append($('#remotes_div'))
        $('#toolbar').tabs({
            activate: window_resize,
            beforeActivate: function(e, ui){
                $('*').blur()
                if(ui.newPanel.selector == "#edit_mode"){
                    e.preventDefault();
                    toggle_edit_mode();
                    return false;
                }
            }
        });
        $('#primary_div').css('height', LAYOUT_HEIGHT);
        $('#toolbar').css('height', LAYOUT_HEIGHT);
        $('#remotes_div').css('height', LAYOUT_HEIGHT);
    }
    $('.remote_button').removeClass('remote_button_mobile')
    $('.key_bind').removeClass('key_bind_mobile')
    $('.voice_bind').removeClass('voice_bind_mobile')
    $('.add_remote_button').removeClass('add_remote_button_mobile')

    return $('#primary_div').outerHeight()
}


function apply_mobile_layout(){
    if(!$('#primary_div').data("ui-tabs")){
        if($('#toolbar').data("ui-tabs")) $('#toolbar').tabs('destroy');
        $('#toolbar').hide();
        $('#primary_tabs').show()
        $('#primary_tabs').prepend($('#edit_check'))
        $('#primary_div').append($('#remotes_div'))
        $('#primary_div').append($('#binds_div'))
        $('#primary_div').append($('#settings_div'))
        $('#primary_div').tabs({
            active:1,
            activate: window_resize,
            beforeActivate: function(e,ui){
                $('*').blur()
                if(ui.newPanel.selector == "#edit_mode"){
                    e.preventDefault();
                    toggle_edit_mode();
                    return false;
                }
            }
        });
        $('#primary_div').css('height', $('#primary_div').outerHeight() + $('#primary_tabs').outerHeight());
    }
    $('.remote_button').addClass('remote_button_mobile')
    $('.key_bind').addClass('key_bind_mobile')
    $('.voice_bind').addClass('voice_bind_mobile')
    $('.add_remote_button').addClass('add_remote_button_mobile')

    return $('#primary_div').outerHeight() - $('#primary_tabs').outerHeight()
}

function align_to_grid(object){
    var top = object.position()['top']
    var left = object.position()['left']
    left = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    top = Math.floor(top / GRID_SIZE) * GRID_SIZE;
    if(left % GRID_SIZE != 0) left += 10
    if(top % GRID_SIZE != 0) top += 10
    object.css({'top':top, 'left':left})
}

// General ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function disable_selected_elements(){
    $('.selected').removeClass('selected')
    current_selection = null
}


function toggle_select(e){
    if(edit_mode){
        if($(e.currentTarget).hasClass('selected')){
            $('.selected').removeClass('selected')
            current_selection = null
        }else{
            $('.selected').removeClass('selected')
            $(e.currentTarget).addClass('selected')
            current_selection = $(e.currentTarget)
        }
    }
}


function toggle_edit_mode(){
    if($('.edit_mode').data('checked') === false){
        $('.edit_mode').data('checked', true)
        edit_mode = true
        $('.edit_mode').removeClass('glyphicon-unchecked')
        $('.edit_mode').addClass('glyphicon-check')
        $('.button_bind').removeClass('clickable')
        $('.remote_button').draggable('enable')
        $('.button_bind').draggable('enable')
        $('.key_bind').draggable('enable')
        $('.voice_bind').draggable('enable')
    }else{
        $('.edit_mode').data('checked', false)
        edit_mode = false
        $('.edit_mode').removeClass('glyphicon-check')
        $('.edit_mode').addClass('glyphicon-unchecked')
        $('.button_bind').addClass('clickable')
        $('.remote_button').draggable('disable')
        $('.button_bind').draggable('disable')
        $('.key_bind').draggable('disable')
        $('.voice_bind').draggable('disable')
        disable_selected_elements()
    }
    console.log("Edit Mode: "+edit_mode)
}

function press_button(button, repeat){
    if(edit_mode || !button.attr('button_id')) return false
    send_code(button);
    if(button.attr('remote_type') == BT) bt_pressed = true;
    else if (repeat && button.attr('remote_type') == IR){intervals.push(setInterval(function(){send_code(button);}, 250))}
    return true
}

function press_button_id(button_id, repeat){
    press_button(buttons[button_id]['dom'], repeat)
    clear_presses()
}


function send_code(button){
    if(ws_ready()){
        var button_id = button.attr('button_id')
        var remote_type = button.attr('remote_type')
        if(!button_id || !remote_type) return false
        data = {}
        try{data[remote_type] = JSON.parse(buttons[button_id]['code'])}
        catch(error){data[remote_type] = buttons[button_id]['code']}
        ws.send(JSON.stringify(data));
        $('[button_id="'+button_id+'"]').focus();
        $('[button_id="'+button_id+'"]').effect('highlight', 250);
        $('[button_id="'+button_id+'"]').blur();
    }
}

function press_buttons(){
    if(ws_ready()){
        data = {}
        var keys_length = Object.keys(bt_keys).length
        if(keys_length > 6) keys_length = 6;
        var mods = 0
        for(var i in bt_mods){
            mods += bt_mods[i];
        }
        var code = [253, keys_length+3, 1, mods, 0]
        var j = 0
        for(var i in bt_keys){
            if(j > 6) break;
            code.push(bt_keys[i])
            j++;
        }
        console.log(code)
        data[1] = code
        ws.send(JSON.stringify(data));

        data = {}
        var code = [253, 5, 2]
        for(var i in bt_mouse){
            code.push(bt_mouse[i])
        }
        console.log(code)
        data[1] = code
        ws.send(JSON.stringify(data));
    }
}





// Handle Input ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var start_time, end_time
function key_down(e) {
    e.preventDefault();
    console.log(e.key)
    add_key_bind(e)
    poll_key_bind(e)

}


function key_up(e) {
    e.preventDefault();
    poll_key_bind_up(e);
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
    if(bt_pressed){
        ws.send(JSON.stringify(clear_bt));
        bt_pressed = false;
        console.log("Clearing BT presses");
    }
    if(intervals.length > 0) console.log("Clearing IR presses");
    for(var i in intervals) clearInterval(intervals[i]);
    intervals = [];
}



function poll_key_bind(e){
    //alert(e.key)
    if(e.key == " ") e.key = "Space"
    var key_code = e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();
    var activity_id = current_activity.attr('activity_id')
    if(key_code in key_binds[activity_id]){
        var key_bind = key_binds[activity_id][key_code]
        if(key_bind['dom']){
            var button_id = $(key_bind['dom']).attr('button_id')
            try{
                var code = buttons[key_bind['button_id']]['code']
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
                $('[button_id="'+button_id+'"]').focus();
                $('[button_id="'+button_id+'"]').effect('highlight', 250);
                $('[button_id="'+button_id+'"]').blur();
            }else if(code[2] == 2){
                console.log("BT Mouse")
                if(code[3] != 0) bt_mouse[0] = code[3];
                if(code[4] == 1) bt_mouse[1] = cursor_x++;
                else if(code[4] == 254) bt_mouse[1] = 255 - cursor_x++;
                if(code[5] == 1) bt_mouse[2] = cursor_y++;
                else if(code[5] == 254) bt_mouse[2] = 255 - cursor_y++;
                if(code[6] != 0) bt_mouse[3] = code[6];
                press_buttons()
                console.log("X: " + cursor_x + " - Y: " + cursor_y)
            }else{
                console.log("Others")
                press_button(key_bind['dom']);
            }
        }
    }
}

function poll_key_bind_up(e){
    if(e.key == " ") e.key = "Space"
    var key_code = e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();
    var activity_id = current_activity.attr('activity_id')
    if(key_code in key_binds[activity_id]){
        var key_bind = key_binds[activity_id][key_code]
        if(key_bind['dom']){
            try{
                var code = buttons[key_bind['button_id']]['code']
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
                //press_button(key_bind['dom']);
            }
        }
    }
}

function bind_button(source, target){
    target.attr('remote_id', source.attr('remote_id'))
    target.attr('button_id', source.attr('button_id'))
    target.attr('name', source.attr('name'))
    target.attr('remote_type', source.attr('remote_type'))
    target.html('<div class="button_label">'+source.attr('name')+'</div>')
    //disable_selected_elements()
    save_button_bind(target)
}


function bind_key(source, target){
    try{
        var activity_id = current_activity.attr('activity_id')
        target.attr('remote_id', source.attr('remote_id'))
        target.attr('button_id', source.attr('button_id'))
        target.attr('name', source.attr('name'))
        target.attr('remote_type', source.attr('remote_type'))
        //target.html(source.html())
        key_binds[activity_id][target.attr('key_code')]['remote_id'] = source.attr('remote_id')
        key_binds[activity_id][target.attr('key_code')]['button_id'] = source.attr('button_id')
        key_binds[activity_id][target.attr('key_code')]['remote_type'] = source.attr('remote_type')
        key_binds[activity_id][target.attr('key_code')]['activity_id'] = activity_id
        target.html('Key: '+target.attr('key_code')+'<br>'+remotes[source.attr('remote_id')]['name']+': '+ source.attr('name'))
        save_key_bind(target)
    }catch(err){
        console.log('Error in bind_key:', err)
        return false
    }
}


function bind_voice(source, target){
    var activity_id = current_activity.attr('activity_id')
    target.attr('remote_id', source.attr('remote_id'))
    target.attr('button_id', source.attr('button_id'))
    target.attr('remote_type', source.attr('remote_type'))
    var name = target.attr('name');
    voice_binds[activity_id][target.attr('bind_id')]['remote_id'] = source.attr('remote_id')
    voice_binds[activity_id][target.attr('bind_id')]['button_id'] = source.attr('button_id')
    voice_binds[activity_id][target.attr('bind_id')]['remote_type'] = source.attr('remote_type')
    voice_binds[activity_id][target.attr('bind_id')]['activity_id'] = activity_id
    target.html("")
    target.append('<div tabindex="-1">Voice: '+name+'</div>')
    target.append('<div tabindex="-1">'+remotes[source.attr('remote_id')]['name']+': '+buttons[source.attr('button_id')]['name']+'</div>')
    save_voice_bind(target)
}

// Display ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
    });
    if(current_activity == null) current_activity = $('#activity_tab' + Object.keys(activity)[0])
    if(($('#activities_div').data("ui-tabs"))) $('#activities_div').tabs('refresh');
    else{
        $("#activities_div").tabs({
            beforeActivate: function(e, ui){
                $('*').blur()
                if(ui.newPanel.selector == "#add_activity"){
                    e.preventDefault();
                    add_activity()
                    return false
                }else{
                    current_activity = $(ui.newPanel.selector)
                    display_key_binds(current_activity.attr('activity_id'))
                    display_voice_binds(current_activity.attr('activity_id'))
                }
            },
        });
    }
    //$('#activities_div').tabs({active: current_activity});
}


function display_remote(remote){
    if(!(remote['id'] in remotes)) remotes[remote['id']] = remote
    $('#remotes_tabs').append('<li><a id="remote_tab'+remote['id']+'" href="#remote_div'+remote['id']+'">'+remote['name']+'</a></li>')
    var remotes_tab = $('#remote_tab'+remote['id'])
    remotes_tab.attr('remote_id', remote['id'])
    remotes_tab.attr('remote_type', remote['remote_type'])
    remotes_tab.addClass('remote_tab').addClass('deleteable')
    $('#remotes_div').append('<div id="remote_div'+remote['id']+'"></div>')
    var remote_div = $('#remote_div'+remote['id'])
    remote_div.attr('remote_id', remote['id'])
    remote_div.attr('remote_type', remote['remote_type'])
    remote_div.addClass('remote_div')
    remote_div.css('padding-bottom', 0)
    remotes_tab.draggable({
        helper: "clone",
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
    });
    //if(!edit_mode) remotes_tab.draggable('disable');
    if(remote['remote_type'] == IR){
        var html = '<div id="learn'+remote['id']+'" remote_id="'+remote['id']+'" class="button add_remote_button">Add Button</div><br>'
        $('#remote_div'+remote['id']).append(html)
        var learn = $('#learn'+remote['id'])
        //learn.html('<a href="#" class="btn btn-info btn-lg"><span class="glyphicon glyphicon-plus-sign"></span> Button</a>')
        learn.click(add_remote_button)
    }
    for(var button_id in buttons){
        if(buttons[button_id]['remote_id'] == remote['id']){
            display_remote_button(buttons[button_id])
        }
    }
    if($('#remotes_div').data("ui-tabs")) $('#remotes_div').tabs('refresh');
    else{
        $("#remotes_div").tabs({
            beforeActivate: function(e, ui){
                $('*').blur()
                if(ui.newPanel.selector == "#add_remote"){
                    e.preventDefault();
                    add_remote()
                    return false
                }else current_remote = $(ui.newPanel.selector);
            },
        });
    }
    window_resize()
}


function display_remote_button(button){
    if(button['id'] == undefined) return false
    if(!(button['id'] in buttons)) buttons[button['id']] = button
    buttons[button['id']]['remote_type'] = remotes[button['remote_id']]['remote_type']
    $('#remote_div'+button['remote_id']).append('<div id="'+button['id']+'">'+button['name']+'</div>')
    var temp_button = $('#'+button['id'])
    //console.log($('#remote_div'+button['remote_id']))
    //console.log(temp_button)
    temp_button.attr('button_id', button['id'])
    temp_button.attr('remote_id', button['remote_id'])
    temp_button.attr('name', button['name'])
    temp_button.attr('remote_type', remotes[button['remote_id']]['remote_type'])
    temp_button.addClass('remote_button').addClass('deleteable')
    temp_button.attr('tabindex', -1)
    buttons[button['id']]['dom'] = temp_button
    temp_button.on('mousedown',function(e){
        if(current_selection && current_selection.hasClass('button_bind')){
            bind_button($(this), current_selection)
            if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        }else if(current_selection && current_selection.hasClass('key_bind')){
            bind_key($(this), current_selection)
            if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        }else if(current_selection && current_selection.hasClass('voice_bind')){
            bind_voice($(this), current_selection)
            if($('#primary_div').data("ui-tabs")) $('#primary_div').tabs({active: 1})
        }else{
            press_button($(this))
        }
    });
    temp_button.draggable({
        helper: "clone",
        revert: false,
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
    });
    if(!edit_mode) temp_button.draggable('disable')
    return temp_button
}


function display_button_bind(button){
    if('id' in button) var bind_id = button['id'];
    else var bind_id = "temp"+temp_id++
    var html = '<div id="button_bind'+bind_id+'"></div>';
    if('activity_id' in button && button['activity_id'] in activities) var activity_id = button['activity_id']
    else var activity_id = current_activity.attr('activity_id')
    $('#activity_div'+activity_id).append(html)
    var temp_button = $('#button_bind'+bind_id)
    temp_button.css({position: 'absolute'});
    if('x' in button && 'y' in button) temp_button.css({top: button['y'], left: button['x'], position: 'absolute'});
    else{
        bind_x += 40
        bind_y += 40
        if(bind_x >= $('#activities_div').width()-100) bind_x = 0;
        if(bind_y >= $('#activities_div').height()-100) bind_y = 40;
        temp_button.css({top: bind_y, left: bind_x, position: 'absolute'});
    }
    align_to_grid(temp_button)
    if(!(bind_id in button_binds)) button_binds[bind_id] = {}
    button_binds[bind_id]['dom'] = temp_button
    button_binds[bind_id]['interval'] = null
    temp_button.attr('activity_id', activity_id)
    if('button_id' in button && button['button_id'] in buttons){
        temp_button.attr('button_id', button['button_id'])
        temp_button.attr('remote_id', button['remote_id'])
        temp_button.attr('remote_type', remotes[button['remote_id']]['remote_type'])
        temp_button.html('<div class="button_label">'+buttons[button['button_id']]['name']+'</div>')
    }
    temp_button.attr('class', $(this).attr('class'))
    if('classes' in button) temp_button.attr('class', button['classes'])
    temp_button.addClass('deleteable').addClass('button_bind')
    temp_button.removeClass('clickable').removeClass('template').removeClass('selected')
    temp_button.draggable({
        grid: [GRID_SIZE, GRID_SIZE],
        containment: $('#activities_div'),
        drag: function(e,ui){align_to_grid($(this))},
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){
            $('.add').html('<span class="glyphicon glyphicon-plus"></span>')
            save_button_bind($(this))
        },
    });
    if(!edit_mode) temp_button.draggable('disable');
    temp_button.droppable({
        accept: ".remote_button",
        drop: function(e,ui){bind_button($(ui.helper), $(e.target))},
        over: function(e,ui){ui.draggable.css("cursor", "copy");},
        out:  function(e,ui){ui.draggable.css("cursor", "initial");}
    });
    temp_button.on('mousedown', function(e){
        if(!edit_mode){
            press_button($(this), true)
        }
    });
    temp_button.click(function(e){toggle_select(e)});
    return temp_button
}


function display_key_binds(activity_id){
    $('#key_binds').html("")
    for(var key_code in key_binds[activity_id]){
        var id = key_binds[activity_id][key_code]['id']
        var button_id = key_binds[activity_id][key_code]['button_id']
        $('#key_binds').append('<li id="k'+id+'"tabindex="-1">Key: '+key_code+'<br>'+remotes[key_binds[activity_id][key_code]['remote_id']]['name']+': '+buttons[button_id]['name']+'</li>')
        var key_bind = $('#k'+id)
        key_binds[activity_id][key_code]['dom'] = key_bind
        key_bind.attr('button_id', button_id)
        key_bind.attr('remote_id', key_binds[activity_id][key_code]['remote_id'])
        key_bind.attr('activity_id', activity_id)
        key_bind.attr('remote_type', buttons[button_id]['remote_type'])
        key_bind.attr('key_code', key_code)
        key_bind.addClass('key_bind').addClass('deleteable')
        key_bind.click(function(e){toggle_select(e)});
    }
    $('.key_bind').draggable({
        helper: "clone",
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
    });
    if(!edit_mode) $('.key_bind').draggable('disable');
    $('.key_bind').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            bind_key($(ui.helper), $(e.target))
        }
    });
}
/*
function display_macros(activity_id){
    $('#activity_macros').html("")
    for(var macro in macros[activity_id]){
        var id = macros[activity_id][macro]['id']
        //var button_id = macros[activity_id][macro]['button_id']
        $('#activity_macros').append('<li id="k'+id+'"tabindex="-1">Key: '+key_code+'<br>'+remotes[key_binds[activity_id][key_code]['remote_id']]['name']+': '+buttons[button_id]['name']+'</li>')
        var key_bind = $('#k'+id)
        key_binds[activity_id][key_code]['dom'] = key_bind
        key_bind.attr('button_id', button_id)
        key_bind.attr('remote_id', key_binds[activity_id][key_code]['remote_id'])
        key_bind.attr('activity_id', activity_id)
        key_bind.attr('remote_type', buttons[button_id]['remote_type'])
        key_bind.attr('key_code', key_code)
        key_bind.addClass('key_bind').addClass('deleteable')
        key_bind.click(function(e){toggle_select(e)});
    }
    $('.key_bind').draggable({
        helper: "clone",
    });
    if(!edit_mode) $('.key_bind').draggable('disable');
    $('.key_bind').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            bind_key($(ui.helper), $(e.target))
        }
    });
}
*/
function display_voice_binds(activity_id){
    if(annyang) annyang.removeCommands()
    var commands = {}
    $('#voice_binds').html("")
    for(var i in voice_binds[activity_id]){
        var id = voice_binds[activity_id][i]['id']
        var button_id = voice_binds[activity_id][i]['button_id']
        var remote_id = voice_binds[activity_id][i]['remote_id']
        var name = voice_binds[activity_id][i]['name']
        $('#voice_binds').append('<div id="voice_bind'+id+'" tabindex="-1"></div>')
        var voice_bind = $('#voice_bind'+id)
        voice_bind.append('<div tabindex="-1">Voice: '+name+'</div>')
        voice_bind.append('<div tabindex="-1">'+remotes[remote_id]['name']+': '+buttons[button_id]['name']+'</div>')
        voice_binds[activity_id][i]['dom'] = voice_bind
        voice_bind.attr('name', name)
        voice_bind.attr('bind_id', id)
        voice_bind.attr('button_id', button_id)
        voice_bind.attr('remote_id', remote_id)
        voice_bind.attr('activity_id', activity_id)
        voice_bind.attr('remote_type', buttons[button_id]['remote_type'])
        voice_bind.addClass('voice_bind').addClass('deleteable')
        voice_bind.click(function(e){toggle_select(e)});
        commands[name] = new Function('press_button($("#'+voice_bind.attr('id')+'")); clear_presses();')
    }
    console.log(commands)
    if(annyang) annyang.addCommands(commands);
    $('.voice_bind').draggable({
        helper: "clone",
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
    });
    if(!edit_mode) $('.voice_bind').draggable('disable');
    $('.voice_bind').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            bind_voice($(ui.helper), $(e.target))
        }
    });
}

// Add ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function add_activity(){
    var name = prompt("Enter new activity name"); if(name === null) return false;
    name = name.trim(); if(name == "") return false;
    console.log("Adding activity: "+name)
    data = {'add_activity': {'name':name}}
    ws.send(JSON.stringify(data));
}

function add_activity_callback(dict){
    console.log(dict)
    var activity = dict['activity']
    var temp_key_binds = dict['key_binds']
    var id = activity['id']
    key_binds[id] = {}
    for(var i in temp_key_binds[id]){
        key_binds[id][i] = temp_key_binds[id][i];
    }
    console.log("Added activity: "+id)
    activities[id] = activity
    display_activity(activities[id])
}


function add_remote(){
    var name = prompt("Enter new remote name"); if(name === null) return false;
    name = name.trim();
    if(name == "") return false;
    console.log("Adding remote: "+name)
    data = {'add_remote': {'name':name, 'remote_type':IR, 'device_id':2}}
    ws.send(JSON.stringify(data));
}

function add_remote_callback(remote_dict){
    var id = remote_dict['id']
    console.log("Added remote: "+id)
    remotes[id] = remote_dict
    remotes[id]['buttons'] = {}
    console.log(remotes[id])
    display_remote(remotes[id])
}


function add_remote_button(){
    if(ws_ready()){
        var name = prompt("Enter a name for the new button")
        if(name == null || name == "") return false
        data = {}
        data[3] = {}
        data[3]['name'] = name
        data[3]['remote_id'] = $(this).attr('remote_id');
        ws.send(JSON.stringify(data));
    }
}


function add_bind(){
    if(current_bind && current_bind.attr('id') == "key_binds"){waiting4key = true; console.log('waiting4key:', waiting4key)}
    else if(current_bind && current_bind.attr('id') == "voice_binds") add_voice_bind();
}


function add_key_bind(e){
    if(!waiting4key) return false
    if(e.key == " ") e.key = "Space"
    var key_code = e.key.charAt(0).toUpperCase() + e.key.slice(1).toLowerCase();
    var activity_id = current_activity.attr('activity_id')
    if(!(key_code in key_binds[activity_id])){
        var id = "tempk"+temp_id++
        $('#key_binds').append('<li id="'+id+'" class="key_bind deleteable" tabindex="-1" key_code="'+key_code+'">'+key_code+' - UNASSIGNED</li>')
        var key_bind = $('#'+id)
        key_bind.attr('activity_id', activity_id)
        key_bind.click(function(e){toggle_select(e)});
        $('.key_bind').draggable({
            helper: "clone",
            start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
            stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
        });
        if(!edit_mode) $('.key_bind').draggable('disable');
        $('.key_bind').droppable({
            accept: ".remote_button",
            drop: function(e,ui){
                bind_key($(ui.helper), $(e.target))
            }
        });
        key_bind.focus()
        key_binds[activity_id][key_code] = {}
        key_binds[activity_id][key_code]['id'] = id
        key_binds[activity_id][key_code]['dom'] = key_bind
        key_binds[activity_id][key_code]['activity_id'] = activity_id
    }
    waiting4key = false
}



function add_voice_bind(){
    var name = prompt("Enter new voice bind"); if(name === null) return false;
    name = name.trim(); if(name == "") return false;
    console.log("Adding voice bind: "+name)
    var activity_id = current_activity.attr('activity_id')
    var id = "temp"+temp_id++
    $('#voice_binds').append('<div id="voice_bind'+id+'" tabindex="-1"></div>')
    var voice_bind = $('#voice_bind'+id)
    voice_bind.append('<div tabindex="-1">Voice: '+name+'</div>')
    //voice_bind.append('<div tabindex="-1">'+remotes[remote_id]['name']+': '+buttons[button_id]['name']+'</div>')
    voice_binds[activity_id][id] = {}
    voice_binds[activity_id][id]['dom'] = voice_bind
    voice_bind.attr('bind_id', id)
    voice_bind.attr('name', name)
    voice_bind.attr('activity_id', activity_id)
    voice_bind.addClass('voice_bind').addClass('deleteable')
    voice_bind.click(function(e){toggle_select(e)});
    $('.voice_bind').draggable({
        helper: "clone",
        start: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-trash"></span>')},
        stop: function(e,ui){$('.add').html('<span class="glyphicon glyphicon-plus"></span>')}
    });
    if(!edit_mode) $('.voice_bind').draggable('disable');
    $('.voice_bind').droppable({
        accept: ".remote_button",
        drop: function(e,ui){
            bind_voice($(ui.helper), $(e.target))
        }
    });
    voice_bind.focus()
    voice_binds[activity_id][id] = {}
    voice_binds[activity_id][id]['id'] = id
    voice_binds[activity_id][id]['dom'] = voice_bind
    voice_binds[activity_id][id]['activity_id'] = activity_id
}


// Save ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var temp_button_bind
function save_button_bind(button){
    temp_button = button
    console.log("Saving button bind...")
    console.log(button)
    var data = {}
    var id = button.attr('id')
    if(id && id.indexOf("temp") < 0) data['id'] = id.replace('button_bind', '')
    data['remote_id'] = button.attr('remote_id')
    data['button_id'] = button.attr('button_id')
    data['activity_id'] = button.attr('activity_id')
    data['classes'] = button.attr('class')
    data['x'] = parseInt(button.position()['left'])
    data['y'] = parseInt(button.position()['top'])
    ws.send(JSON.stringify({'save_button_bind':data}));
}


function save_button_bind_callback(button_bind){
    var id = button_bind['id'];
    $('#button_bind'+id).attr('id', "button_bind"+id)
}

var temp_key_bind
function save_key_bind(button){
    temp_key_bind = button
    console.log("Saving key bind...")
    var data = {}
    data['remote_id'] = button.attr('remote_id')
    data['button_id'] = button.attr('button_id')
    data['activity_id'] = button.attr('activity_id')
    data['key_code'] = button.attr('key_code')
    console.log(data)
    ws.send(JSON.stringify({'save_key_bind':data}));
}


function save_key_bind_callback(button){
    var id = button['id'];
    console.log("Saved!")
    temp_key_bind.attr('id', 'k'+id)
}

var temp_voice_bind
function save_voice_bind(button){
    temp_voice_bind = button
    console.log("Saving voice bind...")
    console.log(button)
    var data = {}
    var id = button.attr('id')
    if(id && id.indexOf("temp") < 0) data['id'] = id.replace('voice_bind', '')
    data['remote_id'] = button.attr('remote_id')
    data['button_id'] = button.attr('button_id')
    data['activity_id'] = button.attr('activity_id')
    data['name'] = button.attr('name')
    ws.send(JSON.stringify({'save_voice_bind':data}));
}

function save_voice_bind_callback(bind){
    var id = bind['id']
    console.log("Voice bind saved!")
    if(id) temp_voice_bind.attr('id', "voice_bind"+id)
    var commands = {}
    commands[bind['name']] = new Function('press_button($("#voice_bind'+id+'")); clear_presses();')
    console.log(commands)
    if(annyang) annyang.addCommands(commands);
}

// DELETE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function delete_object(e,ui){
    var object = $(ui.helper.context)
    if(object.hasClass("activity_tab")) delete_activity(object);
    else if(object.hasClass("remote_tab")) delete_remote(object);
    else if(object.hasClass("remote_button")) delete_remote_button(object);
    else if(object.hasClass("button_bind")) delete_button_bind(object);
    else if(object.hasClass("key_bind")) delete_key_bind(object);
    else if(object.hasClass("voice_bind")) delete_voice_bind(object);
}


function delete_activity(activity){
    if(del_prompt){if(!confirm('Are you sure you want to delete this activity?')) return false;}
    var id = activity.attr('activity_id')
    console.log("Deleting activity: " + id)
    ws.send(JSON.stringify({'delete_activity':id}));
}

function delete_activity_callback(id){
    console.log(id)
    $('#activity_tab'+id).effect('explode',{pieces: 200}, 500)
    $('#activity_tab'+id).remove()
    $('#activity_div'+id).effect('explode',{pieces: 200}, 500)
    $('#activity_div'+id).remove()
    $('#activities_div').tabs("refresh")
    window_resize()
}


function delete_remote(remote){
    if(del_prompt){if(!confirm('Are you sure you want to delete this remote?')) return false;}
    var id = remote.attr('remote_id')
    console.log("Deleting remote: "+id)
    console.log("Deleting remote: "+remote.attr('name'))
    ws.send(JSON.stringify({'delete_remote':id}));
}


function delete_remote_callback(id){
    console.log(id)
    for(var i in button_binds){
        if(button_binds[i]['dom'].attr('remote_id') == id){
            button_binds[i]['dom'].html("")
            button_binds[i]['dom'].attr('remote_id', null)
            button_binds[i]['dom'].attr('button_id', null)
        }
    }
    for(var i in key_binds){
        for(var j in key_binds[i]){
            if(key_binds[i][j]['remote_id'] == id){
                delete key_binds[i][j]
            }
        }
    }
    $('.key_bind').each(function(){
        if($(this).attr('remote_id') == id){
            $(this).effect('explode',{pieces: 20}, 500)
            $(this).remove()
        }
    });
    delete remotes[id]
    $('#remote_tab'+id).effect('explode',{pieces: 20}, 500)
    $('#remote_tab'+id).remove()
    $('#remote_div'+id).remove()
    $('#remotes_div').tabs("refresh")
    window_resize()
    console.log("Deleted remote!")
}


function delete_remote_button(button){
    if(del_prompt){if(!confirm('Are you sure you want to delete this button?')) return false;}
    var id = button.attr('button_id')
    console.log("Deleting button: "+button.attr('name'))
    ws.send(JSON.stringify({'delete_remote_button':id}));
}


function delete_remote_button_callback(id){
    //Delete the button
    for(var i in button_binds){
        if(button_binds[i]['dom'].attr('button_id') == id){
            button_binds[i]['dom'].html("")
            button_binds[i]['dom'].attr('remote_id', null)
            button_binds[i]['dom'].attr('button_id', null)
            delete button_binds[i]
        }
    }
    for(var i in key_binds){
        for(var j in key_binds[i]){
            if(key_binds[i][j]['button_id'] == id){
                delete key_binds[i][j]
            }
        }
    }
    $('.key_bind').each(function(){
        if($(this).attr('button_id') == id){
            $(this).effect('explode',{pieces: 20}, 500)
            $(this).remove()
        }
    });
    delete buttons[id]
    $('#'+id).effect('explode',{pieces: 20}, 500)
    $('#'+id).remove()
    console.log("Deleted button: "+id)

}


function delete_button_bind(button_bind){
    if(del_prompt){if(!confirm('Are you sure you want to delete this button bind?')) return false;}
    var id = button_bind.attr('id').replace("button_bind", "")
    console.log("Deleting button bind: "+button_bind.attr('name'))
    ws.send(JSON.stringify({'delete_button_bind':id}));
}

function delete_button_bind_callback(id){
    console.log(id)
    delete button_binds[id]
    $('#button_bind'+id).effect('explode',{pieces: 20}, 500)
    $('#button_bind'+id).remove()
    console.log("Deleted button bind!")
}

function delete_key_bind(key_bind){
    if (del_prompt){if(!confirm('Are you sure you want to delete this key bind?')) return false;}
    var id = key_bind.attr('id')
    var key_code = key_bind.attr('key_code')
    console.log("Deleting key bind: "+key_code)
    ws.send(JSON.stringify({'delete_key_bind':id}));
}


function delete_key_bind_callback(dict){
    try{
        var id = 'k'+dict['id']
        var activity_id = dict['activity_id']
        var key_code = dict['key_code']
        delete key_binds[activity_id][key_code]
    }catch(err){
        var id = dict
    }
    $('#'+id).effect('explode',{pieces: 20}, 500)
    $('#'+id).remove()
    console.log("Deleted key bind!")
}



function delete_voice_bind(voice_bind){
    if(del_prompt){if(!confirm('Are you sure you want to delete this voice bind?')) return false;}
    var id = voice_bind.attr('id').replace('voice_bind', '')
    console.log("Deleting voice bind: "+voice_bind.attr('name'))
    ws.send(JSON.stringify({'delete_voice_bind':id}));
}


function delete_voice_bind_callback(dict){
    try{
        var id = dict['id']
        delete voice_binds[dict['activity_id']][dict['id']];
        if(annyang) annyang.removeCommands(dict['name'])
    }catch(err){
        var id = dict
    }
    $('#voice_bind'+id).effect('explode',{pieces: 20}, 500)
    $('#voice_bind'+id).remove()
    console.log("Deleted voice bind!")

}

function dom2dict(dom){
    var dict = {}
    for (var i = 0; i < elem.attributes.length; i++) {
        var attr = elem.attributes[i];
        if (attr.specified) dict[attr.name] = attr.value;
    }
    return dict
}