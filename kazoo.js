/*
	Kazoo WebRTC/RTMP Library v0.1
	Created by Jean-Roch Maitre and Maxime Roux for 2600hz (jr@2600hz.com / max@2600hz.com).
*/

(function () {
	var kazoo = {
		config: {
			paths: {
				AC_OETags: '/lib/dependencies/rtmp/AC_OETags.js',
				VideoIO: '/lib/dependencies/rtmp/VideoIO',
				SIPjs: '/lib/dependencies/sip/sip.js',
				SIPml5js: '/lib/dependencies/sip/sipml5.js'
			},
		},
		rtmp: {},
		sipjs: {}
	},
	errors = {
		serverNotReachable: {
			key: "server_not_reachable",
			message: "Could not reach the server."
		},
		unauthorized: {
			key: "unauthorized",
			message: "Invalid credentials."
		},
		forbidden: {
			key: "forbidden",
			message: "Forbidden."
		},
		disconnected: {
			key: "disconnected",
			message: "You have been disconnected."
		}
	},
	notifications = {
		"overriding": {
			key: "overriding_registration",
			message: "You have overridden an existing registration for this device."
		},
		"replaced": {
			key: "replaced_registration",
			message: "You have been disconnected: someone else has registered this device."
		},
		"voicemail": {
			key: "voicemail_notification",
			message: "You have one or more voicemail message(s)."
		},
		"connectivity": {
			key: "connectivity_notification",
			message: {
				online: "You have recovered your connection to the network.",
				offline: "You have lost your connection to the network."
			},
			status : {
				online: "online",
				offline: "offline"
			}
		},
		"reconnecting": {
			key: "reconnecting_notification",
			message: "Attempting to reconnect..."
		},
		"transfered": {
			key: "transfer_notification",
			message: "Transfer successful."
		},
		"default": {
			key: "unknown_notification",
			message: "You have received a SIP notification."
		},
	},
	connectivity = {
		isOnline: window.navigator.onLine,
		onlineHistory: [],
		connectivityCallback: function(onlineHistory) {},
		onlineTimerFunction: function() {
			if(window.navigator.onLine !== connectivity.isOnline) {
				connectivity.isOnline = window.navigator.onLine;
				connectivity.onlineHistory.push({
					status: connectivity.isOnline ? notifications.connectivity.status.online : notifications.connectivity.status.offline,
					time: new Date()
				});
				connectivity.connectivityCallback(connectivity.onlineHistory);
			}
		},
		onlineTimer: 0
	};

	function kazooLoadScript(scriptSrc, callback) {
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = scriptSrc;
		script.async = true;

		script.onreadystatechange = script.onload = function() {
			var state = script.readyState;
			if (!callback.done && (!state || /loaded|complete/.test(state))) {
				callback.done = true;
				callback();
			}
		};

		document.getElementsByTagName('head')[0].appendChild(script);
	};

	function getFlashMovie(movieName) {
		var isIE = navigator.appName.indexOf("Microsoft") != -1;
		return (isIE) ? window[movieName] : document[movieName];
	};

	kazoo.init = function(params) {
		if(params.forceRTMP) {
			loadRTMP();
		}
		else {
			getSupportedVersion();
		}

		function getSupportedVersion() {
			if(!window.mozRTCPeerConnection && !navigator.webkitGetUserMedia){
				loadRTMP();
			}
			else {
				loadSIPml5();
				// loadSIPjs();
			}
		};

		function loadRTMP() {
			if(getFlashMovie('kazooRTMP') === undefined) {
				kazooLoadScript(kazoo.config.paths.AC_OETags, function() {
					var hasProductInstall = DetectFlashVer(6, 0, 65),
						hasVersion10 = DetectFlashVer(10, 0, 0),
						hasVersion10_3 = DetectFlashVer(10, 3, 0),
						hasVersion11 = DetectFlashVer(11, 0, 0);

					var flashHTML = '';

					if (hasProductInstall && !hasVersion10) {
						var MMPlayerType = (isIE == true) ? "ActiveX" : "PlugIn";
						var MMredirectURL = window.location;
						document.title = document.title.slice(0, 47) + " - Flash Player Installation";
						var MMdoctitle = document.title;

						flashHTML = AC_FL_RunContent(
							"src", "playerProductInstall",
							"FlashVars", "MMredirectURL="+MMredirectURL+'&MMplayerType='+MMPlayerType+'&MMdoctitle='+MMdoctitle+"",
							"width", "215",
							"height", "138",
							"align", "middle",
							"wmode", "transparent",
							"id", "kazooRTMP",
							"quality", "high",
							"bgcolor", "#000000",
							"name", "kazooRTMP",
							"camera", "false",
							"play", "true",
							"loop", "false",
							"allowScriptAccess","always",
							"type", "application/x-shockwave-flash",
							"pluginspage", "http://www.adobe.com/go/getflashplayer"
						);
					}
					else if (hasVersion10) {
						 flashHTML = AC_FL_RunContent(
							"src", kazoo.config.paths.VideoIO,
							"width", "215",
							"height", "138",
							"wmode", "transparent",
							"align", "middle",
							"id", "kazooRTMP",
							"quality", "high",
							"camera", "false",
							"play", "true",
							"loop", "false",
							"bgcolor", "#000000",
							"name", "kazooRTMP",
							"allowScriptAccess","always",
							"allowFullScreen","true",
							"type", "application/x-shockwave-flash",
							"pluginspage", "http://www.adobe.com/go/getflashplayer"
						);
					}

					kazoo.version = 'rtmp';

					var container = document.createElement('div');
					container.id = 'kazooVideoPlayer';
					container.innerHTML = flashHTML;

					if('flashContainer' in params && params.flashContainer !== '') {
						document.getElementById(params.flashContainer).appendChild(container);
					}
					else {
						document.getElementsByTagName('body')[0].appendChild(container);
					}

					kazoo.rtmp.container = container;

					if(hasProductInstall) {
						var testTimer = setInterval(function () {
							if (typeof getFlashMovie('kazooRTMP').setProperty === 'function') {
								clearInterval(testTimer);

								params.onLoaded && params.onLoaded();
							}
						},
						500);
					} else {
						if(typeof params.onFlashMissing === 'function') {
							params.onFlashMissing(container);
						} else {
							container.innerHTML = 'This content requires the Adobe Flash Player. <a href=http://www.adobe.com/go/getflash/>Get Flash</a>';
						}
					}
				});
			}
		};

		function loadSIPjs() {
			kazooLoadScript(kazoo.config.paths.SIPjs, function() {
				kazoo.version = 'sipjs';

				kazoo.videoRemote = document.createElement('video');
				kazoo.videoRemote.id = 'kazooVideoRemote';
				kazoo.videoRemote.style.display = 'none';
				document.getElementsByTagName('body')[0].appendChild(kazoo.videoRemote);

				params.onLoaded && params.onLoaded();
			});
		}
	
	  function loadSIPml5() {
			kazooLoadScript(kazoo.config.paths.SIPml5js, function() {
				kazoo.version = 'sipml5';

				kazoo.videoRemote = document.createElement('video');
				kazoo.videoRemote.id = 'kazooVideoRemote';
				kazoo.videoRemote.style.display = 'none';
				document.getElementsByTagName('body')[0].appendChild(kazoo.videoRemote);

				params.onLoaded && params.onLoaded();
			});
		}
	};

	kazoo.register = function(params) {
		params.reconnectMaxAttempts = isNaN(params.reconnectMaxAttempts) ? -1 : parseInt(params.reconnectMaxAttempts);
		params.reconnectDelay = isNaN(params.reconnectDelay) ? 5 : parseInt(params.reconnectDelay) || 1;
		if(params.reconnectDelay > 60) { params.reconnectDelay = Math.ceil(params.reconnectDelay/1000); }
		kazoo.params = params;

		if(kazoo.version === 'rtmp') {
			var server = params.rtmpUrl,
				user = params.privateIdentity + '@' + params.realm,
				authname = params.privateIdentity,
				authpass = params.password,
				displayname = params.publicIdentity,
				rate = 8,
				rateName = 'narrowband';

			var phone = getFlashMovie('kazooRTMP'),
				srcValue = server + '/' +user+ '?rate=' +rate+ '&bidirection=true' + '&arg=' +authname+ '&arg=' +authpass+ '&arg=' +displayname+ '&arg=' +rateName;

			phone.setProperty('src', srcValue);
			kazoo.rtmp.phone = phone;

			onPropertyChange = function(event) {
				switch(event.property) {
					case 'src': {
						if(event.newValue !== null) { // If src newValue has been set
							kazoo.rtmp.isConnecting = true;
						} else { // If src newValue is null
							if(kazoo.rtmp.isConnecting) {
								params.onError && params.onError({
									key: errors.serverNotReachable.key,
									message: errors.serverNotReachable.message,
									source: event
								});
								if(kazoo.isReconnecting
								&& (kazoo.params.reconnectMaxAttempts < 0 || kazoo.reconnectAttempt < kazoo.params.reconnectMaxAttempts)) {
									setTimeout(function() {
										kazoo.reconnect();
									}, kazoo.params.reconnectDelay);
								} else {
									kazoo.stopAutoReconnect();
								}
							} else if(kazoo.rtmp.isConnected) {
								params.onError && params.onError({
									key: errors.disconnected.key,
									message: errors.disconnected.message,
									source: event
								});
								if(params.reconnectMaxAttempts) { kazoo.startAutoReconnect(); }
							}
							kazoo.rtmp.isConnected = false;
							kazoo.rtmp.isConnecting = false;
						}
						break;
					}
					case 'nearID': {
						if(event.newValue !== null) {
							kazoo.rtmp.isConnecting = false;
							kazoo.rtmp.isConnected = true;
							kazoo.isReconnecting = false;
							params.onConnected && params.onConnected();
						}
						break;
					}
					case 'camera': {
						if(event.newValue === true) {
							phone.setProperty('camera', false);
						}
					}
					default: {
						break;
					}
				}
			};

			onCallback = function(event) {
				console.log('onCallback', event);
				switch(event.method) {
					case 'ringing': {
						params.onRinging && params.onRinging();

						break;
					}
					case 'rejected': {
						var matchResult = event.args.length ? event.args[0].match(/^(\d{3}) ?(.*)$/) : null,
							cancelStatus = {
								source: event
							};

						if(matchResult) {
							cancelStatus.code = parseInt(matchResult[1], 10);
							cancelStatus.message = matchResult[2];
						} else if(event.args.length) {
							cancelStatus.message = event.args[0];
						}

						params.onCancel && params.onCancel(cancelStatus);

						break;
					}
					case 'cancelled': {
						params.onCancel && params.onCancel({
							message: "Originator Cancel",
							source: event
						});
						break;
					}
					case 'invited': {
						// Pull caller name and number from the caller id string
						var callerIdString = event.args[0];
						var matches = /^(.*) <sip:\+?(\d+)@.*$/i.exec(callerIdString);
						var callerName, callerNumber;
						if (matches && matches.length >= 3) {
							callerName = matches[1];
							callerNumber = matches[2];
						} else {
							callerName = event.args[0];
							callerNumber = null;
						}
					
						var call = {
							accept: function() {
								phone.callProperty('call', 'accept');

								kazoo.rtmp.isCalling = true;
							},
							reject: function() {
								phone.callProperty('call', 'reject', '486 Busy Here');
							},
							callerName: callerName,
							callerNumber: callerNumber
						};

						params.onIncoming && params.onIncoming(call);

						break;
					}
					case 'accepted': {
						phone.setProperty('publish', 'local');
						phone.setProperty('play', 'remote');

						if(kazoo.rtmp.isCalling) {
							params.onAccepted && params.onAccepted();
						} else {
							kazoo.rtmp.isCalling = true;
							params.onConnecting && params.onConnecting();
						}

						break;
					}
					case 'byed': {
						phone.setProperty('publish', null);
						phone.setProperty('play', null);
						kazoo.rtmp.isCalling = false;

						params.onHangup && params.onHangup();

						break;
					}
					case 'notified': {
						var notificationType = event.args[1].substring(0, event.args[1].indexOf(':')),
							notification = {};

						switch(notificationType) {
							case 'Overwrote': {
								notification = {
									key: notifications.overriding.key,
									message: notifications.overriding.message
								};
								break;
							}
							case 'Replaced-By': {
								notification = {
									key: notifications.replaced.key,
									message: notifications.replaced.message
								};
								break;
							}
							case 'Message-Account': {
								notification = {
									key: notifications.voicemail.key,
									message: notifications.voicemail.message
								};
								break;
							}
							default: {
								notification = {
									key: notifications['default'].key,
									message: notifications['default'].message
								};
							}
						}
						notification.source = event;
						params.onNotified && params.onNotified(notification);
						break;
					}
					case 'unauthorized': {
						var matchResult = event.args.length ? event.args[0].match(/^(\d{3}) ?(.*)$/) : null,
							errCode = matchResult && matchResult[1] ? parseInt(matchResult[1], 10) : 0;

						kazoo.rtmp.isConnecting = false;
						switch(errCode) {
							case 403: //Forbidden
								params.onError && params.onError({
									key: errors.forbidden.key,
									message: errors.forbidden.message,
									code: errCode,
									source: event
								});
								break;
							case 401: //Unauthorized
							case 407: //Proxy Authentication Required
							default:
								params.onError && params.onError({
									key: errors.unauthorized.key,
									message: errors.unauthorized.message,
									code: errCode,
									source: event
								});
								break;
						}
						break;
					}
					default: {
						console.log(event);
						break;
					}
				}
			};
		}
		else if(kazoo.version === 'sipjs') {
			kazoo.sipjs.userAgent = new SIP.UA({
				uri: params.publicIdentity,
				//reliable: SIP.C.supported.SUPPORTED,
				rel100: SIP.C.supported.SUPPORTED,
				wsServers: [params.wsUrl],
				authorizationUser: params.privateIdentity,
				password: params.password,
				traceSip: true,
				wsServerMaxReconnection: params.reconnectMaxAttempts >= 0 ? params.reconnectMaxAttempts : 10,
				wsServerReconnectionTimeout: params.reconnectDelay,
				connectionRecoveryMinInterval: 5,
				stunServers: []
			});

			kazoo.sipjs.userAgent.on('connected', function(arg) {
				kazoo.sipjs.connected = true;
				console.info('connected', arg);
			});

			kazoo.sipjs.userAgent.on('disconnected', function(arg) {
				console.log(kazoo.sipjs.connected, kazoo.sipjs.manualDisconnect);
				if(!kazoo.sipjs.connected) {
					params.onError && params.onError({
						key: errors.serverNotReachable.key,
						message: errors.serverNotReachable.message,
						source: arg
					});
				} else {
					if(kazoo.sipjs.manualDisconnect) {
						kazoo.sipjs.manualDisconnect = false;
					} else {
						params.onError && params.onError({
							key: errors.disconnected.key,
							message: errors.disconnected.message,
							source: arg
						});
					}
					kazoo.sipjs.connected = false;
				}
				console.info('disconnected', arg);
			});

			kazoo.sipjs.userAgent.on('registered', function(arg) {
				kazoo.sipjs.registered = true;
				console.info('registered', arg);
				params.onConnected && params.onConnected();
			});

			kazoo.sipjs.userAgent.on('unregistered', function(arg) {
				kazoo.sipjs.registered = false;
				console.info('unregistered', arg);
			});

			kazoo.sipjs.userAgent.on('registrationFailed', function(e) {
				console.info('registrationFailed', e);
				var errCode = e ? e.status_code || 0 : 0;
				switch(e.status_code) {
					case 401: //Unauthorized
					case 407: //Proxy Authentication Required
					{
						params.onError && params.onError({
							key: errors.unauthorized.key,
							message: errors.unauthorized.message,
							code: errCode,
							source: e
						});
						break;
					}
					case 403: //Forbidden
					{
						params.onError && params.onError({
							key: errors.forbidden.key,
							message: errors.forbidden.message,
							code: errCode,
							source: e
						});
						break;
					}
				}
			});

			kazoo.sipjs.userAgent.on('invite', function(session) {
				console.log(kazoo.sipjs.session);
				console.info('invite', session);
				if(typeof kazoo.sipjs.session === 'undefined') {
					kazoo.sipjs.session = session;
					kazoo.sipjs.bindSessionEvents(kazoo.sipjs.session);

					var call = {
						accept: function() {
							kazoo.sipjs.session.accept({
								media: {
									constraints: {
										audio: true,
										video: false
									},
									render: {
										remote: {
											video: kazoo.videoRemote
										}
									}
								}
							});
						},
						reject: function() {
							session.reject();

							delete kazoo.sipjs.session;
						},
						callerName: session.request.from.displayName,
						callerNumber: session.request.from.uri.user
					};

					params.onIncoming && params.onIncoming(call);
				}
				
				// window.invite = arg;
			});

			kazoo.sipjs.userAgent.on('message', function(arg) {
				console.info('message', arg);
			});

			kazoo.sipjs.userAgent.on('notify', function(arg) {
				console.info('notify', arg);
				var notificationType = arg.body.substring(0, arg.body.indexOf(':')),
					notification = {};

				switch(notificationType) {
					case 'Overwrote': {
						notification = {
							key: notifications.overriding.key,
							message: notifications.overriding.message
						}
						break;
					}
					case 'Replaced-By': {
						notification = {
							key: notifications.replaced.key,
							message: notifications.replaced.message
						}
						break;
					}
					case 'Message-Account': {
						notification = {
							key: notifications.voicemail.key,
							message: notifications.voicemail.message
						}
						break;
					}
					default: {
						notification = {
							key: notifications['default'].key,
							message: notifications['default'].message
						}
					}
				}
				notification.source = arg;
				params.onNotified && params.onNotified(notification);
			});

			kazoo.sipjs.bindSessionEvents = function(session) {

				session.on('progress', function(response) {
					console.info('progress', response);
					if(response instanceof SIP.IncomingResponse) {
						params.onConnecting && params.onConnecting();
					}
				});

				session.on('accepted', function(arg) {
					console.info('accepted', arg);
					params.onAccepted && params.onAccepted();
				});

				session.on('rejected', function(arg) {
					console.info('rejected', arg);
                                       if (!params.onCancel) {
                                               return;
                                       }
                                       if (arg) {
                                               params.onCancel({
                                                       "code": arg.status_code,
                                                       "message": arg.reason_phrase,
                                                       "source": arg
                                               });
                                       } else {
                                               params.onCancel();
                                       }
				});

				session.on('failed', function(arg) {
					console.info('failed', arg);
				});

				session.on('connecting', function(arg) {
					console.info('connecting', arg);
				});

				session.on('cancel', function(arg) {
					console.info('cancel', arg);
					delete kazoo.sipjs.session;

					params.onCancel && params.onCancel();
				});

				session.on('refer', function(arg) {
					console.info('refer', arg);
					params.onNotified && params.onNotified({
						key: notifications.transfered.key,
						message: notifications.transfered.message,
						source: arg
					});
				});

				session.on('dtmf', function(arg) {
					console.info('dtmf', arg);
				});

				session.on('muted', function(arg) {
					console.info('muted', arg);
				});

				session.on('unmuted', function(arg) {
					console.info('unmuted', arg);
				});

				session.on('bye', function(arg) {
					console.info('bye', arg);
					delete kazoo.sipjs.session;

					kazoo.params.onHangup && kazoo.params.onHangup();
				});
			};
		}
  
    else if(kazoo.version === 'sipml5') {
		
			kazoo.sipjs.StackeventsListener = function(e){
        console.info('stack event = ' + e.type);
        if(e.type == 'started'){
          //kazoo.sipjs.connected = true;
			    sipml5login();
			    console.info('connected', e);
        }
        if(e.type =='stopped'){
          console.log(kazoo.sipjs.connected, kazoo.sipjs.manualDisconnect);
  				if(!kazoo.sipjs.connected) {
  					params.onError && params.onError({
  						key: errors.serverNotReachable.key,
  						message: errors.serverNotReachable.message,
  						source: e
  					});
  				} else {
  					if(kazoo.sipjs.manualDisconnect) {
  						kazoo.sipjs.manualDisconnect = false;
  					} else {
  						params.onError && params.onError({
  							key: errors.disconnected.key,
  							message: errors.disconnected.message,
  							source: e
  						});
  					}
  					kazoo.sipjs.connected = false;
  				}
  				console.info('disconnected', e);
        }
        if(e.type =='m_permission_accepted'){
          kazoo.sipjs.registered = true;
			    console.info('registered', e);
			    params.onConnected && params.onConnected();
        }
        if(e.type =='stopped'){
          kazoo.sipjs.registered = false;
			    console.info('unregistered', e);
        }
        if(e.type =='m_permission_refused'){
          console.info('registrationFailed', e);
  				var errCode = e ? e.getSipResponseCode() || 0 : 0;
  				switch(e.status_code) {
  					case 401: //Unauthorized
  					case 407: //Proxy Authentication Required
  					{
  						params.onError && params.onError({
  							key: errors.unauthorized.key,
  							message: errors.unauthorized.message,
  							code: errCode,
  							source: e
  						});
  						break;
  					}
  					case 403: //Forbidden
  					{
  						params.onError && params.onError({
  							key: errors.forbidden.key,
  							message: errors.forbidden.message,
  							code: errCode,
  							source: e
  						});
  						break;
  					}
  				}
        }
        if(e.type =='i_new_call'){
            console.log(kazoo.sipjs.session);
    				console.info('invite', e.newsession);
    				if(typeof kazoo.sipjs.session === 'undefined') {
    					kazoo.sipjs.session = e.newsession;
    					kazoo.sipjs.bindSessionEvents(kazoo.sipjs.session);
              console.log(kazoo.sipjs.session);
    					var call = {
    						accept: function() {
    							kazoo.sipjs.session.accept({
    								media: {
    									constraints: {
    										audio: true,
    										video: false
    									},
    									render: {
    										remote: {
    											video: kazoo.videoRemote
    										}
    									}
    								}
    							});
    						},
    						reject: function() {
    							kazoo.sipjs.session.reject();
    
    							delete kazoo.sipjs.session;
    						},
    						callerName: kazoo.sipjs.session.getRemoteFriendlyName,
    						callerNumber: kazoo.sipjs.session.getRemoteUri
    					};
            //startRingTone();
  					params.onIncoming && params.onIncoming(call);
           }
        }
        
      };
			kazoo.sipjs.stack = new SIPml.Stack({
          realm: params.realm, // mandatory: domain name
          impi: params.privateIdentity, // mandatory: authorization name (IMS Private Identity)
          impu: params.publicIdentity, // mandatory: valid SIP Uri (IMS Public Identity)
          password: params.password, // optional
          //display_name: 'Bob legend', // optional
          websocket_proxy_url: params.wsUrl, // optional
          //outbound_proxy_url: 'udp://example.org:5060', // optional
          enable_rtcweb_breaker: true, // optional
          events_listener: { events: '*', listener: kazoo.sipjs.StackeventsListener }, // optional: '*' means all events
          sip_headers: [ // optional
                  { name: 'User-Agent', value: 'IM-client/OMA1.0 sipML5-v1.0.0.0' },
                  { name: 'Organization', value: 'Kixie' }
          ]
      });
			
      kazoo.sipjs.stack.start();

      
      
      var registerSession;
      kazoo.sipjs.SessioneventsListener = function(e){
          console.info('session event = ' + e.type);
          if(e.type == 'connected' && e.session == registerSession){
            kazoo.sipjs.connected = true;
			      console.info('connected', e);
	      		notification = {
							key: notifications.connectivity.key,
							message: notifications.connectivity.message.online,
							status: notifications.connectivity.status.online
						};
						notification.source = e;
						console.info(notification);
				    params.onNotified && params.onNotified(notification);
          }
          
          
      };
      
      sipml5login = function(){
          registerSession = kazoo.sipjs.stack.newSession('register', {
              events_listener: { events: '*', listener: kazoo.sipjs.SessioneventsListener } // optional: '*' means all events
          });
          registerSession.register();
      };


			/*kazoo.sipjs.userAgent.on('message', function(arg) {
				console.info('message', arg);
			});*/

			/*kazoo.sipjs.userAgent.on('notify', function(arg) {
				console.info('notify', arg);
				var notificationType = arg.body.substring(0, arg.body.indexOf(':')),
					notification = {};

				switch(notificationType) {
					case 'Overwrote': {
						notification = {
							key: notifications.overriding.key,
							message: notifications.overriding.message
						}
						break;
					}
					case 'Replaced-By': {
						notification = {
							key: notifications.replaced.key,
							message: notifications.replaced.message
						}
						break;
					}
					case 'Message-Account': {
						notification = {
							key: notifications.voicemail.key,
							message: notifications.voicemail.message
						}
						break;
					}
					default: {
						notification = {
							key: notifications['default'].key,
							message: notifications['default'].message
						}
					}
				}
				notification.source = arg;
				params.onNotified && params.onNotified(notification);
			});*/

			kazoo.sipjs.bindSessionEvents = function(session) {
        
        console.log(session);
        if(session.type =='connecting'){
          console.info('connecting', session);
        }

        if(session.type =='terminating' || session.type =='terminated'){
          console.info('cancel', session);
					delete kazoo.sipjs.session;

					params.onCancel && params.onCancel();
					kazoo.params.onHangup && kazoo.params.onHangup();
        }
				
				/*session.on('progress', function(response) {
					console.info('progress', response);
					if(response instanceof SIP.IncomingResponse) {
						params.onConnecting && params.onConnecting();
					}
				});*/

        if(session.type =='conected'){
        	console.info('accepted', arg);
					params.onAccepted && params.onAccepted();
        }
        

				/*session.on('rejected', function(arg) {
					console.info('rejected', arg);
                                       if (!params.onCancel) {
                                               return;
                                       }
                                       if (arg) {
                                               params.onCancel({
                                                       "code": arg.status_code,
                                                       "message": arg.reason_phrase,
                                                       "source": arg
                                               });
                                       } else {
                                               params.onCancel();
                                       }
				});*/

				/*session.on('failed', function(arg) {
					console.info('failed', arg);
				});*/

				

				/*session.on('refer', function(arg) {
					console.info('refer', arg);
					params.onNotified && params.onNotified({
						key: notifications.transfered.key,
						message: notifications.transfered.message,
						source: arg
					});
				});

				session.on('dtmf', function(arg) {
					console.info('dtmf', arg);
				});

				session.on('muted', function(arg) {
					console.info('muted', arg);
				});

				session.on('unmuted', function(arg) {
					console.info('unmuted', arg);
				});*/

				/*session.on('bye', function(arg) {
					console.info('bye', arg);
					delete kazoo.sipjs.session;

					kazoo.params.onHangup && kazoo.params.onHangup();
				});*/
			};
		}

		if(typeof params.onNotified === 'function') {
			connectivity.connectivityCallback = function(onlineHistory) {
				var notification = {
					key: notifications.connectivity.key,
					message: notifications.connectivity.message[onlineHistory[onlineHistory.length-1].status],
					status: onlineHistory[onlineHistory.length-1].status,
					time: onlineHistory[onlineHistory.length-1].time,
					history: onlineHistory
				}
				params.onNotified(notification);
				if(kazoo.version != 'sipjs' && notification.status === 'online' && params.reconnectMaxAttempts) { 
					kazoo.startAutoReconnect(); 
				}
			}
		}
	};

	kazoo.startAutoReconnect = function() {
		if(!kazoo.isReconnecting && 'params' in kazoo) {
			kazoo.isReconnecting = true;
			kazoo.reconnectAttempt = 0;

			setTimeout(function() {
				if(kazoo.isReconnecting) {
					kazoo.reconnect();
				}
			}, kazoo.reconnectDelay);
		}
	};

	kazoo.stopAutoReconnect = function() {
		kazoo.isReconnecting = false;
	};

	kazoo.reconnect = function() {
		try {
			kazoo.logout();
		} finally {
			kazoo.params.onNotified({
				key: notifications.reconnecting.key,
				message: notifications.reconnecting.message,
				attempt: kazoo.reconnectAttempt+=1
			});
			setTimeout(function() { kazoo.register(kazoo.params); }, 1000);
		}
	};

	kazoo.hangup = function() {
		if(kazoo.version === 'rtmp') {
			kazoo.rtmp.phone.callProperty('call', 'bye');
			kazoo.rtmp.phone.setProperty('publish', null);
			kazoo.rtmp.phone.setProperty('play', null);

			kazoo.rtmp.isCalling = false;

			kazoo.params.onHangup && kazoo.params.onHangup();
		}
		else if(kazoo.version === 'sipjs') {
			if(kazoo.sipjs.session.dialog) {
				kazoo.sipjs.session.bye();
			} else {
				kazoo.sipjs.session.close();
				kazoo.params.onHangup && kazoo.params.onHangup();
			}
			delete kazoo.sipjs.session;
		}
		else if(kazoo.version === 'sipml5') {
			if(kazoo.sipjs.session.dialog) {
				kazoo.sipjs.session.hangup();
			} else {
				kazoo.sipjs.session.hangup();
				kazoo.params.onHangup && kazoo.params.onHangup();
			}
			delete kazoo.sipjs.session;
		}
	};

	kazoo.logout = function() {
		if(kazoo.version === 'rtmp') {
			if(kazoo.rtmp.isCalling === true) {
				kazoo.hangup();
			}

			kazoo.rtmp.phone.setProperty('src', '');
			kazoo.rtmp.isConnected = false;
		}
		else if(kazoo.version === 'sipjs') {
			kazoo.sipjs.manualDisconnect = true;
			kazoo.sipjs.userAgent.stop();
			delete kazoo.sipjs.session;
		}
		else if(kazoo.version === 'sipml5') {
			kazoo.sipjs.manualDisconnect = true;
			kazoo.sipjs.stack.stop();
			delete kazoo.sipjs.session;
		}

		connectivity.connectivityCallback = function(onlineHistory) {};
	};

	kazoo.transfer = function(destination) {
		if(kazoo.version === 'rtmp') {
			kazoo.rtmp.phone.callProperty('call', 'transfer', destination);
		}
		else if(kazoo.version === 'sipjs') {
			kazoo.sipjs.session.refer(destination);
		}
		else if(kazoo.version === 'sipml5') {
			kazoo.sipjs.session.transfer(destination);
		}

		kazoo.params.onTransfer && kazoo.params.onTransfer();
	};

	//Destination should be a sip address like: sip:1234@realm.com
	kazoo.connect = function(destination) {
		if(destination) {
			if(kazoo.version === 'rtmp') {
				if (!kazoo.hasFlashMicrophonePermission()) {
					kazoo.showFlashSettings();
				}
				kazoo.rtmp.phone.callProperty('call', 'invite', destination);
			}
			else if(kazoo.version === 'sipjs') {
				kazoo.sipjs.session = kazoo.sipjs.userAgent.invite(destination, {
					media: {
						constraints: {
							audio:  true,
							video: false
						},
						render: {
							remote: {
								video: kazoo.videoRemote
							}
						}
					}
				});
				kazoo.sipjs.bindSessionEvents(kazoo.sipjs.session);
			}
		}
		else if(kazoo.version === 'sipml5') {
				kazoo.sipjs.session = kazoo.sipjs.stack.newSession('call-audio');
				
				kazoo.sipjs.session.call(destination);
				kazoo.sipjs.bindSessionEvents(kazoo.sipjs.session);
			}
	};
	
	//Destination should be a sip address like: sip:1234@realm.com
	kazoo.connectKixie = function(destination,audioSource) {
		if(destination) {
			if(kazoo.version === 'rtmp') {
				if (!kazoo.hasFlashMicrophonePermission()) {
					kazoo.showFlashSettings();
				}
				kazoo.rtmp.phone.callProperty('call', 'invite', destination);
			}
			else if(kazoo.version === 'sipjs') {
				kazoo.sipjs.session = kazoo.sipjs.userAgent.invite(destination, {
					media: {
						constraints: {
							audio:  {optional: [{sourceId: audioSource}]},
							video: false
						},
						render: {
							remote: {
								video: kazoo.videoRemote
							}
						}
					}
				});
				kazoo.sipjs.bindSessionEvents(kazoo.sipjs.session);
			}
			else if(kazoo.version === 'sipml5') {
				kazoo.sipjs.session = kazoo.sipjs.stack.newSession('call-audio');
				
				kazoo.sipjs.session.call(destination);
				kazoo.sipjs.bindSessionEvents(kazoo.sipjs.session);
			}
		}
	};

	//dtmf should be a character included in this list: '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '#', '*'.
	kazoo.sendDTMF = function(dtmf) {
		var acceptedDTMF = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '#', '*'];

		if(acceptedDTMF.indexOf(dtmf) >= 0) {
			if(kazoo.version === 'rtmp') {
				kazoo.rtmp.phone.callProperty('call', 'sendDTMF', dtmf);
			}
			else if(kazoo.version === 'sipjs') {
				kazoo.sipjs.session.dtmf(dtmf);
			}
			else if(kazoo.version === 'sipml5') {
				kazoo.sipjs.session.dtmf(dtmf);
			}
		}
		else {
			console.log('dtmf not supported');
		}
	};

	kazoo.muteMicrophone = function(mute, success, error) {
		if(kazoo.version === 'rtmp') {
			if('phone' in kazoo.rtmp) {
				if(!('originalGain' in kazoo.rtmp)) {
					kazoo.rtmp.originalGain = kazoo.rtmp.phone.getProperty('gain') || 0.5;
				}

				if(mute) {
					kazoo.rtmp.phone.setProperty('gain', 0);
				} else {
					kazoo.rtmp.phone.setProperty('gain', kazoo.rtmp.originalGain);
				}
				success && success();
			} else {
				error && error();
			}
		}
		else if(kazoo.version === 'sipjs') {
			if(kazoo.sipjs.hasOwnProperty('session')) {
				if(mute) {
					kazoo.sipjs.session.mute();
				}
				else {
					kazoo.sipjs.session.unmute();
				}
				
				success && success();
			}
			else {
				error && error();
			}
		}
		else if(kazoo.version === 'sipml5') {
			if(kazoo.sipjs.hasOwnProperty('session')) {
				if(mute) {
					kazoo.sipjs.session.mute('audio',true);
				}
				else {
					kazoo.sipjs.session.mute('audio',false);
				}
				
				success && success();
			}
			else {
				error && error();
			}
		}
	};
	
	kazoo.hasFlashMicrophonePermission = function() {
		if(kazoo.version === 'rtmp') {
			if('phone' in kazoo.rtmp) {
				return kazoo.rtmp.phone.getProperty('deviceAllowed');
			}
		}
		return false;
	};

	kazoo.showFlashSettings = function() {
		if(kazoo.version === 'rtmp') {
			if('phone' in kazoo.rtmp) {
				kazoo.rtmp.phone.callProperty('showSettings');
			}
		}
	};

	kazoo.monitorConnectivity = function(enabled) { //True by default
		if(enabled === false) {
			clearInterval(connectivity.onlineTimer);
			connectivity.onlineTimer = 0;
		} else if(connectivity.onlineTimer === 0) {
			connectivity.onlineTimer = setInterval(connectivity.onlineTimerFunction, 100);
		}
	};

	kazoo.getConnectivityHistory = function() {
		return connectivity.onlineHistory;
	}

	window.kazoo = kazoo;

	kazoo.monitorConnectivity(true);
}());
