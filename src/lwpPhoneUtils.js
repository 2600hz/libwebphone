//Added by Mahfuz 

'use strict';

import EventEmitter from 'events';


let oSipStack,
oSipSessionRegister,
oSipSessionCall,
oSipSessionTransferCall,
registerSession,
oConfigCall,onSipEventSession,
onSipEventStack,
oNotifICall;

class lwpPhoneUtils extends EventEmitter {

   // constructor(libwebphone, config = {}, i18n = null) {
        //NO Action For now under construcor 
   // } //end of constructor  

} //end of lwpPhoneUtils class


export default lwpPhoneUtils;

export function StartStack
    (value_realm,
        value_impi,
        value_impu,
        value_password,
        value_displayname,
        value_wsservice,
        value_iceservice,
        audioRemote,
        videoLocal,
        videoRemote
    ) {
    try {
        onSipEventStack = function (e) {

            SIPml.init(function (e) {
                console.info('engine is ready');
            },
                function (e) {
                    console.info('Error: ' + e.message);
                });
                
            switch (e.type) {
                case 'started':
                    {
                        // catch exception for IE (DOM not ready)
                        try {
                            // LogIn (REGISTER) as soon as the stack finish starting
                            oSipSessionRegister = this.newSession('register', {
                                expires: 200,
                                events_listener: { events: '*', listener: onSipEventSession },
                                sip_caps: [
                                    { name: '+g.oma.sip-im', value: null },
                                    //{ name: '+sip.ice' }, // rfc5768: FIXME doesn't work with Polycom TelePresence
                                    { name: '+audio', value: null },
                                    { name: 'language', value: '\"en,fr\"' }
                                ]
                            });
                            oSipSessionRegister.register();
                        }
                        catch (e) {
                            console.log(`${e}`)
                        }
                        break;
                    }
                case 'stopping': case 'stopped': case 'failed_to_start': case 'failed_to_stop':
                    {
                        var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
                        oSipStack = null;
                        oSipSessionRegister = null;
                        oSipSessionCall = null;
                        console.log(bFailure ? "Disconnected: " + e.description + "" : "Disconnected");
                        break;
                    }

                case 'i_new_call':
                    {
                        if (oSipSessionCall) {
                            // do not accept the incoming call if we're already 'in call'
                            e.newSession.hangup(); // comment this line for multi-line support
                        }
                        else {
                            oSipSessionCall = e.newSession;
                            // start listening for events
                            oSipSessionCall.setConfiguration(oConfigCall);
                            uiBtnCallSetText('Answer');
                            //startRingTone();
                            var sRemoteNumber = (oSipSessionCall.getRemoteFriendlyName() || 'unknown');
                            console.log("Incoming call from [" + sRemoteNumber + "]");
                            //showNotifICall(sRemoteNumber);
                        }
                        break;
                    }

                case 'm_permission_requested':
                    {
                        //divGlassPanel.style.visibility = 'visible';
                        break;
                    }
                case 'm_permission_accepted':
                case 'm_permission_refused':
                    {
                        // divGlassPanel.style.visibility = 'hidden';
                        if (e.type == 'm_permission_refused') {
                            //uiCallTerminated('Media stream permission denied');
                        }
                        break;
                    }

                case 'starting': default: break;
            }
        } //End of onSipEventStack

        onSipEventSession = function (e) {
            switch (e.type) {
                case 'connecting':
                    {
                        
                        if (e.session == oSipSessionCall) {
                            if (window.btnBFCP) window.btnBFCP.disabled = false;
                            //if (bConnected) {
                             //   if (oNotifICall) {
                              //      oNotifICall.cancel();
                               //     oNotifICall = null;
                               // }
                           // }
                            console.log(e.description);
                        }
                        break;
                    } // 'connecting' | 'connected'
                case 'connected':
                    {


                     
                        oConfigCall = {
                            audio_remote: document.getElementById(audioRemote),               //mediaforcall.audioRemote,
                            video_local: document.getElementById(videoLocal),                //mediaforcall.videoLocal,
                            video_remote: document.getElementById(videoRemote),               //mediaforcall.videoRemote,
                            bandwidth: { audio: undefined, video: undefined },
                            events_listener: { events: '*', listener: onSipEventSession },
                            sip_caps: [
                                { name: '+g.oma.sip-im' },
                                { name: 'language', value: '\"en,fr\"' }
                            ]
                        };
                        
                        if(e.type == 'connected') 
                                {
                            if (e.session == oSipSessionRegister) {  
                                console.log(`Registration status ${e.description}`);

                            }                            
                        }


                        
                        break;

                    }
                case 'terminating': case 'terminated':
                    {
                        if (e.session == oSipSessionRegister) {
                            // uiOnConnectionEvent(false, false);

                            oSipSessionCall = null;
                            oSipSessionRegister = null;

                            console.log(e.description);
                            console.log('Call Terminated');

                        }
                        else if (e.session == oSipSessionCall) {
                            //uiCallTerminated(e.description);
                        }
                        break;
                    } // 'terminating' | 'terminated'

                case 'm_stream_video_local_added':
                    {
                        if (e.session == oSipSessionCall) {
                            //uiVideoDisplayEvent(true, true);
                        }
                        break;
                    }
                case 'm_stream_video_local_removed':
                    {
                        if (e.session == oSipSessionCall) {
                            //uiVideoDisplayEvent(true, false);
                        }
                        break;
                    }
                case 'm_stream_video_remote_added':
                    {
                        if (e.session == oSipSessionCall) {
                            // uiVideoDisplayEvent(false, true);
                        }
                        break;
                    }
                case 'm_stream_video_remote_removed':
                    {
                        if (e.session == oSipSessionCall) {
                            //  uiVideoDisplayEvent(false, false);
                        }
                        break;
                    }

                case 'm_stream_audio_local_added':
                case 'm_stream_audio_local_removed':
                case 'm_stream_audio_remote_added':
                case 'm_stream_audio_remote_removed':
                    {
                        break;
                    }

                case 'i_ect_new_call':
                    {
                        oSipSessionTransferCall = e.session;
                        break;
                    }

                case 'i_ao_request':
                    {
                        if (e.session == oSipSessionCall) {
                            var iSipResponseCode = e.getSipResponseCode();
                            if (iSipResponseCode == 180 || iSipResponseCode == 183) {
                                //startRingbackTone();
                                console.log('Remote ringing...');
                            }
                        }
                        break;
                    }

                case 'm_early_media':
                    {
                        if (e.session == oSipSessionCall) {
                            //stopRingbackTone();
                            // stopRingTone();
                            console.log('Early media started');
                        }
                        break;
                    }

                case 'm_local_hold_ok':
                    {
                        if (e.session == oSipSessionCall) {
                            if (oSipSessionCall.bTransfering) {
                                oSipSessionCall.bTransfering = false;
                            }
                            // btnHoldResume.value = 'Resume';
                            console.log('Call placed on hold: ');
                            oSipSessionCall.bHeld = true;
                        }
                        break;
                    }
                case 'm_local_hold_nok':
                    {
                        if (e.session == oSipSessionCall) {
                            oSipSessionCall.bTransfering = false;
                            // btnHoldResume.value = 'Park Call';
                            console.log('Failed to place remote party on hold');
                        }
                        break;
                    }
                case 'm_local_resume_ok':
                    {
                        if (e.session == oSipSessionCall) {
                            oSipSessionCall.bTransfering = false;
                            //btnHoldResume.value = 'Park Call';
                            //btnHoldResume.disabled = false;
                            console.log('Call taken off hold ');
                            oSipSessionCall.bHeld = false;
                        }
                        break;
                    }
                case 'm_local_resume_nok':
                    {
                        if (e.session == oSipSessionCall) {
                            oSipSessionCall.bTransfering = false;
                            //btnHoldResume.disabled = false;
                            console.log('Failed to resum call');
                        }
                        break;
                    }
                case 'm_remote_hold':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('Placed on call hold by remote party');
                        }
                        break;
                    }
                case 'm_remote_resume':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('Taken off call hold by remote party');
                        }
                        break;
                    }
                case 'm_bfcp_info':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('BFCP Info: ' + e.description);
                        }
                        break;
                    }

                case 'o_ect_trying':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('Call transfer in progress...');
                        }
                        break;
                    }
                case 'o_ect_accepted':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('Call transfer accepted');
                        }
                        break;
                    }
                case 'o_ect_completed':
                case 'i_ect_completed':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('Call transfer completed');
                            if (oSipSessionTransferCall) {
                                oSipSessionCall = oSipSessionTransferCall;
                            }
                            oSipSessionTransferCall = null;
                        }
                        break;
                    }
                case 'o_ect_failed':
                case 'i_ect_failed':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log('Call transfer failed');
                        }
                        break;
                    }
                case 'o_ect_notify':
                case 'i_ect_notify':
                    {
                        if (e.session == oSipSessionCall) {
                            console.log("Call Transfer: " + e.getSipResponseCode() + " " + e.description + "");;
                            if (e.getSipResponseCode() >= 300) {
                                if (oSipSessionCall.bHeld) {
                                    oSipSessionCall.resume();
                                }
                            }
                        }
                        break;
                    }
                case 'i_ect_requested':
                    {
                        if (e.session == oSipSessionCall) {
                            var s_message = "Do you accept call transfer to [" + e.getTransferDestinationFriendlyName() + "]?";//FIXME
                            if (confirm(s_message)) {
                                console.log("Call transfer in progress...");
                                oSipSessionCall.acceptTransfer();
                                break;
                            }
                            oSipSessionCall.rejectTransfer();
                        }
                        break;
                    }
            } //End of switch
        } //End of onSipEventSession

        // create SIP stack
        oSipStack = new SIPml.Stack({
            realm: value_realm,
            impi: value_impi,
            impu: value_impu,
            password: value_password,
            display_name: value_displayname,
            websocket_proxy_url: value_wsservice,
            ice_servers: value_iceservice,
            events_listener: { events: '*', listener: onSipEventStack },
            sip_headers: [
                { name: 'User-Agent', value: 'IM-client/OMA1.0 2600Hz_Softpone_Agent' },
                { name: 'Organization', value: '2600Hz SDK' }
            ]
        }
        );



        registerSession = oSipStack.newSession('register', {
            events_listener: { events: '*', listener: onSipEventStack } // optional: '*' means all events
        });
        registerSession.register();
        console.info('Registered Process passed');

        if (oSipStack.start() != 0) {
            console.log("Failed to start the SIP stack");
        }
    }
    catch (e) {
        console.info("Error: " + e);
    }

    //return Promise.resolve();

} //End of StartStack




export function sipUnRegister() {
    if (oSipStack) {
        oSipStack.stop(); // shutdown all sessions
        console.log('Shutdown all connection');
       // return Promise.resolve();

    }
}//End of sipUnRegister


export function sipCall(s_type, number_tocall) {
    console.log('call type :' + s_type);
    oSipSessionCall = oSipStack.newSession(s_type, oConfigCall);
    if (oSipSessionCall.call(number_tocall) != 0) {
        oSipSessionCall = null;
        console.log('Failed to make call');
        return;
    }
    else if (oSipSessionCall) {
        console.log('Connecting...');
        oSipSessionCall.accept(oConfigCall);
    }
} //End of sipCall


export function sipToggleMuteUnmute()  {
    //TODO: Need to add code

}//End of sipToggleMute


export function stopShareVideoToggle() {
    var i_ret;
    var bMute = !oSipSessionCall.bMute;
    let v = bMute ? 'Stop Video' : 'Resume Video';
    console.log(v);
    i_ret = oSipSessionCall.mute('video', bMute);
    if (i_ret != 0) {
        consile.log('Stop / Resume Video failed');
        return;
    }
    oSipSessionCall.bMute = bMute;
    v = bMute ? "Resume Video" : "Stop video";
    console.log(v);
} //End of MuteUnMuteCallVideo


export function callTransfer(destination) {
    if (oSipSessionCall) {
        var s_destination = destination;

        if (!tsk_string_is_null_or_empty(s_destination)) {
            if (oSipSessionCall.transfer(s_destination) != 0) {
                console.info('Call transfer failed');
                return;
            }
            console.info('Transfering the call to...' + destination);

        }
    }
}// End of CallTransfer

export function sipHangUp() {
    if (oSipSessionCall) {
        console.log('Terminating the call...');
        oSipSessionCall.hangup({ events_listener: { events: '*', listener: onSipEventSession } });
        console.log('Call hanged up');
        //callparkcontainer.innerHTML = "";
    }
}//End of terminates


export function sipSendDTMF(c) {
    if (oSipSessionCall && c) {
        if (oSipSessionCall.dtmf(c) == 0) {
            try {
                console.info('DTMF Event -> You pressed :' + c);
            } catch (e) { console.info('Error from DTMF: ' + e) }
        }
    }
    else if (c) {
        try {
            console.log(`Dial pad button pressed for ${c}`);

        } catch (e) { console.info('Error from DTMF: ' + e) }
    }
    else {
        console.info("Nothing from DTMF")
    }
}//End of sipSendDTMF


/*
export function addparklist() {
    //TODO:

} //End of addparklist



*/

//=================================================================================================
//Experimental fucntion 
/*
export function showNotifICall(s_number) {
    // permission already asked when we registered
    if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) {
        if (oNotifICall) {
            oNotifICall.cancel();
        }
        oNotifICall = window.webkitNotifications.createNotification('images/sipml-34x39.png', 'Incaming call', 'Incoming call from ' + s_number);
        oNotifICall.onclose = function () { oNotifICall = null; };
        oNotifICall.show();
    }
    //return Promise.resolve();
} //End of showNotifICall
*/





