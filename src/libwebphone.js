

'use strict';

import lwpTransport from './lwpTransport';
import lwpMediaDevices from './lwpMediaDevices';
import lwpDialpad from './lwpDialpad';
import lwpPhoneUtils  from './lwpPhoneUtils';
import {
    StartStack,
    sipCall,
    sipHangUp,
    sipUnRegister,    
    stopShareVideoToggle,
    callTransfer,
    sipSendDTMF} from './lwpPhoneUtils';


//Function to load SIPML5 library
function includejs(file) {
    var script = document.createElement('script');
    script.src = file;
    script.type = 'text/javascript';
    //script.defer = true; 
    console.info(script);
    document.getElementsByTagName('head').item(0).appendChild(script);
}

export default class {
    constructor(config = {}, i18n = null) {
      

        this._transportPromise = new lwpTransport(this, config, i18n);
        this._mediaDevicesPromise = new lwpMediaDevices(this, config, i18n);
        this._dialpadPromise = new lwpDialpad(this, config, i18n);

        console.info(`===========PhoneUtils/Login class invoked [start]`);
        this._getPhoneUtils = new lwpPhoneUtils(this,config,i18n);
        console.info(`===========PhoneUtils/Login class invoked [End]`);

      
        console.info('Construction call for kazoo phone libsdk');
        includejs('SIPml-api_2.1.4.js'); //Load the SIPLM JS API 
        console.info('SIP Stack Loaded');

        console.log(`Fetching configuration from dynamic config`);
        const { register } = config; //get objectelement "register" from constructor param "config"  
        console.log(register);
        console.log(`==========Rgistration data after parsing=====[Start]`);
        console.log(register.value_realm);
        console.log(register.value_impi);
        console.log(register.value_impu);
        console.log(register.value_password);
        console.log(register.value_displayname);
        console.log(register.value_wsservice);
        console.log(register.value_iceservice);
        const { mediaforcall } = config;
        console.log(mediaforcall);
        console.log(`=========Rgistration data after parsing=====[End]`);

        console.log(`=========Connect and log attempt to Kazoo platform`);
        StartStack
        (
            register.value_realm,
            register.value_impi,
            register.value_impu,
            register.value_password,
            register.value_displayname,
            register.value_wsservice,
            register.value_iceservice,
            mediaforcall.audioRemote,
            mediaforcall.videoLocal,
            mediaforcall.videoRemote
        );


      

    }//end of constructor

    getTransport() {
        return this._transportPromise;
    }

    getMediaDevices() {
        return this._mediaDevicesPromise;
    }

    getDialpad() {
        return this._dialpadPromise;
    }

    //Added by Mahfuz 
    getPhoneUtils(number,OperationType) 
    {

        
        if(OperationType == "call-audiovideo")
        {
        sipCall('call-audiovideo',number)
        console.log(`Operation performed:  ${OperationType}`)
        }
        else if(OperationType == "call-audio")
        {
            sipCall('call-audio',number)
            console.log(`Operation performed:  ${OperationType}`)
        }
        else if(OperationType == "toggleVideoShareStopResume")
        {
            stopShareVideoToggle();
            console.log(`Operation performed:  ${OperationType}`)
        }
        else if(OperationType == "transfer")
        {
            callTransfer(number);
            console.log(`Operation performed:  ${OperationType}`)
        }
        else if(OperationType == "handgup")
        {
            sipHangUp();
            console.log(`Operation performed:  ${OperationType}`)
        }
        else if(OperationType == "disconnect")
        {
            sipUnRegister();
            console.log(`Operation performed:  ${OperationType}`)
        }


        return  this._getPhoneUtils;
    } //End of getPhoneUtils

    

    
    
    
} //End of default clas