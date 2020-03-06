"use strict";

import EventEmitter from "events";
import i18next from "i18next";
import _ from "lodash";
import Mustache from "mustache";
import * as JsSIP from "jssip";

export default class extends EventEmitter {
  constructor(libwebphone, session) {
    super();
    this._id = this._uuid();
    this._libwebphone = libwebphone;
    this._session = session;
    this._session.on("failed", event => {
      console.log("session failed: ", event);
      this._libwebphone.removeCall(this);
    });
    this._session.on("ended", event => {
      console.log("session ended: ", event);
      this._libwebphone.removeCall(this);
    });
    this._libwebphone.addCall(this);
  }

  getId() {
    return this._id;
  }

  getSession() {
    return this._session;
  }


  hold() {
    this._session.hold();
  }

  unhold() {
    this._session.unhold();
  }
  

  answer() {
    this._libwebphone.getMediaDevices().then(mediaDevices => {
      var stream = mediaDevices.startStreams();
      var options = {
        mediaStream: stream
      };
      this._session.answer(options);
      console.log("inbound session answered: ", this._session);
    });
  }

  hangup() {
    this._session.terminate();
    console.log("hangup session: ", this._session);
  } //end hangup

  /** Util Functions */


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
  

  
  sendDTMF()
 {    let tonevalue =  libwebphone._dialpadPromise.then(dialpad => {
      let digits = dialpad.digits();
      //dialpad.clear();
      //return digits.join("");
      return digits; 
    });
  this._session.sendDTMF(tonevalue);
  console.log('DTMF sent to session: ' + tonevalue);
 }


  transfer() {
      let numbertotransfer =  libwebphone._dialpadPromise.then(dialpad => {
      let digits = dialpad.digits();
      dialpad.clear();
      return digits.join("");
    });
    this._session.refer(numbertotransfer);
    console.log('Call transfer attempt to : ' + numbertotransfer);    
  }
  

  _uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  _merge(...args) {
    return _.merge(...args);
  }
} //end of lwpPhoneUtils class
