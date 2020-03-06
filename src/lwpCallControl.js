"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";
import * as JsSIP from "jssip";

export default class extends EventEmitter {
  constructor(lwpCall, session) {
    super();
    //this._id = this._uuid();
    this._id = session.getId;
    console.log('*********' + this._id);
    this._session = session;
  }

  //getId() {
   // return this._id;
  //}

  //getSession() {
  //  return this._session;
  //}

  /*
  hold() {
    this._session.hold();
    console.log('call on hold');
  }

  unhold() {
    this._session.unhold();
    console.log('call on Un-hold');
  }

  /*
 sendDTMF()
 {
  //let tonevalue;
  //if (!tonevalue) {
      let tonevalue = await this._dialpadPromise.then(dialpad => {
      let digits = dialpad.digits();
      //dialpad.clear();
      //return digits.join("");
      return digits; 
    });
  //}
  this._session.sendDTMF(tonevalue);
  console.log('DTMF sent to session: ' + tonevalue);
 }


  transfer() {
    let numbertotransfer;
     if (!numbertotransfer) {
      numbertotransfer = await this._dialpadPromise.then(dialpad => {
      let digits = dialpad.digits();
      dialpad.clear();
      return digits.join("");
    });
   }
    this._session.refer(numbertotransfer);
    this_session.tr
    console.log('Call transfer attempt to : ' + numbertotransfer);    
  }
  */
  
  /*
  mute()
  {
    this._session.mute();
    console.log('call on mute');
  }
  
  unmute()
  {
    this._session.unmute();
    console.log('call on un-muted');
  }

  renegotiate()
  {
    this._session.renegotiate();
    console.log('call on renegotiate');
  }
   */

  /** Util Functions */

 /*
  _uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  */


  _renderCalls() {
    let renderConfig = this._calls.map(call => {
      return {
        callId: call.getId(),
        inbound: call.getSession().direction == "incoming"
      };
  });
    let html = Mustache.render(this._callControlTemplate(), {
      calls: renderConfig
    });
    let element = document.getElementById("call_list");
    element.innerHTML = html;
  }



  _callControlTemplate() {
    return `
    {{#calls}}
    <div id={{callId}}>
     {{callId}}: 
      <button onclick="webphone.getCall('{{callId}}').hangup();">
        Hang-up
      </button>
      <button onclick="webphone.getCall('{{callId}}').hold();">
        Hold  
      </button>
      <button onclick="webphone.getCall('{{callId}}').unhold();">
        UnHold
      </button>  
      <button onclick="webphone.getCall('{{callId}}').mute();">
        Mute
      </button>  
      <button onclick="webphone.getCall('{{callId}}').unmute();">
       Un-Mute
      </button>
      <button onclick="webphone.getCall('{{callId}}').sendDTMF();">
      SendDTMF
     </button>
      <button onclick="webphone.getCall('{{callId}}').transfer();">
      Transfer
     </button>
     <button onclick="webphone.getCall('{{callId}}').renegotiate();">
     Renegotiate
     </button>      
      {{#inbound}}
      <button onclick="webphone.getCall('{{callId}}').answer();">
        Answer
      </button>
      {{/inbound}}
    </div>
    {{/calls}}
    `;
  }

  _merge(...args) {
    return _.merge(...args);
  }
} //end of lwpPhoneUtils class
